'use strict';

const {OP, ADDR_MODE, FLAGS, INSTRUCTION_ALIASES, XOP} = require('./opcodes');
const {bts2n, n2bts, N_TO_BT_DIGIT, BT_DIGIT_TO_N} = require('balanced-ternary');
const {nonary2bts} = require('nonary');
const {sv2bts} = require('base27');
const {get_trit} = require('trit-getset');
const {high_tryte, low_tryte} = require('./word');
const ttFromUnicode = require('trit-text').fromUnicode;

// assembler

// syntax
// opcode operands
//
// operands
// # = immediate mode
// % = trits, 0i1, base 3                    iiiii 5
// no prefix = decimal, base 10
// $ = nonary, base 9, each digit two trits aabbcc 3
// & = base 27, each digit three trits       aabbb 2
class Assembler {
  constructor() {
    this.symbols = new Map();
    this.unresolved_symbols = [];
  }

  add_symbol(name, value) {
    // TODO: error on duplicate symbol definitions

    this.symbols.set(name, value);
    // also add low and high trytes (5-trit), useful for immediate mode, registers
    this.symbols.set(`${name}.low`, low_tryte(value));
    this.symbols.set(`${name}.high`, high_tryte(value));
  }

  assemble(lines) {
    // TODO: port to run on cpu (self-hosting)
    let output = [];

    let code_offset = 0;
    let origin = 0;

    let emit = function(tryte) {
      console.log('emit',n2bts(tryte));
      output.push(tryte);
      ++code_offset;
    }

    for (let line of lines) {
      if (line.endsWith(':')) {
        // labels TODO: support other instructions on line
        const label = line.substring(0, line.length - 1);
        if (this.symbols.has(label)) {
          throw new Error(`label symbol redefinition: ${label}, in line=${line}`);
        }
        this.add_symbol(label, origin + code_offset);
        continue;
      }

      // 'opcode' is first token, 'rest' is everything after
      let opcode, rest;
      if (line.indexOf(' ') !== -1) {
        opcode = line.substr(0, line.indexOf(' '));
        rest = line.substr(line.indexOf(' ') + 1);
      } else {
        opcode = line;
      }

      // TODO: comments, ; to end-of-line

      // Convenience aliases
      // ex: branch, beq (s=0), bne (s!=0) br s>0, s=0, s<0 brsen brgz brlp
      if (INSTRUCTION_ALIASES[opcode]) opcode = INSTRUCTION_ALIASES[opcode];

      let addressing_mode, operand, extra, operand_unresolved_at;

      if (opcode.charAt(0) === '.') {
        // assembler directives
        opcode = opcode.substring(1);

        if (opcode === 'equ') {
          // .equ value name
          // TODO: reverse
          let name;
          if (rest.indexOf(' ') !== -1) {
            name = rest.substr(rest.indexOf(' ') + 1);
            operand = rest.substr(0, rest.indexOf(' '));
          } else {
            operand = rest;
          }

          ({addressing_mode, operand, operand_unresolved_at} = this.parse_operand(operand, line, code_offset));

          if (this.symbols.has(name)) {
            throw new Error('symbol redefinition: '+name+', in line: '+line);
          }

          this.add_symbol(name, operand);
          console.log(`assigned symbol ${name} to ${operand}`);
        } else if (opcode === 'org') {
          ({addressing_mode, operand, operand_unresolved_at} = this.parse_operand(rest, line, code_offset));

          if (operand === undefined) throw new Error('.org directive requires operand, in line: '+line);
          origin = operand;
        } else if (opcode === 'data') {
          // only string literals for now, TODO
          if (!rest.startsWith('"') || !rest.endsWith('"')) throw new Error(`.text directive requires double-quoted string, in line=${line}`);
          const text = rest.substring(1, rest.length - 1);
          for (const char of text) {
            // TODO: support escape codes, same as character literals below
            // TODO: and maybe raw digits "foobar",0, with any kind of literals. like '.db', but not data bytes; rather, trytes. it's all .data
            const tt = ttFromUnicode(char);
            if (tt === null || tt === undefined) throw new Error(`invalid trit-text character «${char}» in string literal, in line=${line}`);
            emit(tt);
          }
          continue;
        } else {
          throw new Error(`unrecognized assembler directive ${opcode}, in line=${line}`);
        }
      } else if (OP[opcode] !== undefined) {
        // alu

        if (rest === undefined) {
          throw new Error(`alu opcode ${opcode} requires operand, in line=${line}`);
        }

        ({addressing_mode, operand, operand_unresolved_at} = this.parse_operand(rest, line, code_offset));
        let opcode_value = OP[opcode]; // aaab0 3-trits

        let tryte = opcode_value * Math.pow(3,2) +
          addressing_mode * Math.pow(3,1) +
          0;

        emit(tryte);

        switch(addressing_mode) {
          case ADDR_MODE.IMMEDIATE:
            if (!Number.isInteger(operand)) {
              throw new Error('opcode '+opcode+' (immediate) requires operand: '+operand+', in line: '+line);
            }

            emit(operand);
            break;

          case ADDR_MODE.ABSOLUTE:
            if (!Number.isInteger(operand)) {
              throw new Error('opcode '+opcode+' (absolute) requires operand: '+operand+', in line: '+line);
            }

            // TODO: endian?
            emit(low_tryte(operand));
            emit(high_tryte(operand));
            break;
        }
      } else if (XOP[opcode] !== undefined) {
        if (rest !== undefined) {
          throw new Error(`xop opcode unexpected operand ${rest}, in line=${line}`);
        }

        let opcode_value = XOP[opcode]; // aaaai 4-trits

        let tryte = opcode_value * Math.pow(3,1) + (-1);
        emit(tryte);
      } else if (opcode.charAt(0) === 'B') {
        ({addressing_mode, operand, operand_unresolved_at} = this.parse_operand(rest, line, code_offset));

        if (opcode.charAt(1) === 'R' && opcode.length === 5) { // BR opcodes
          let flag = opcode.charAt(2);
          let direction = opcode.charAt(3);
          let compare = opcode.charAt(4);

          let flag_value = FLAGS[flag];
          if (flag_value === undefined) {
            throw new Error('invalid flag '+flag+' in branch instruction '+opcode);
          }
          let direction_value = {
            L:-1, '<':-1,
            E:0, '=':0,
            N:1, '!':1
          }[direction];
          if (direction_value === undefined) {
            throw new Error('invalid direction '+direction+' in branch instruction '+opcode);
          }
          let compare_value = {N:-1, Z:0, P:1}[compare];
          if (compare_value === undefined) {
            throw new Error('invalid comparison trit '+compare_value+' in branch instruction '+opcode);
          }
          console.log(`branch opcode=${opcode}, flag=${flag_value}/${flag}, direction=${direction_value}/${direction} compare=${compare_value}/${compare}`);;

          // aabc1 a=flag, b=direction, c=trit for comparison
          let tryte = flag_value * Math.pow(3,3) +
            direction_value * Math.pow(3,2) +
            compare_value * Math.pow(3,1) +
            1;

          let rel_address;
          switch(addressing_mode) {
            case ADDR_MODE.IMMEDIATE:
              // 'immediate mode' branch instructions, BEQ #+2, means encode relative offset directly
              rel_address = operand;
              break;

            case ADDR_MODE.ABSOLUTE:
              if (operand_unresolved_at !== undefined) {
                // use current code placeholder to satisfy range check (rel=0
                operand = code_offset + origin + 2;
                // patch relative address from resolved absolute address
                this.unresolved_symbols[operand_unresolved_at].addressing_mode = ADDR_MODE.BRANCH_RELATIVE;
              }

              // given absolute address, need to compute relative to current location for instruction encoding
              // -2 to account for size of the branch instruction (opcode+operand) itself
              rel_address = operand - (code_offset + origin) - 2;

              if (rel_address < -121 || rel_address > 121) {
                throw new Error(`branch instruction to too-far absolute address: operand=${operand} (unresolved? ${operand_unresolved_at}), code_offset=${code_offset}, rel_address=${rel_address}, in line=${line}`);
              }

              break;

            default:
              throw new Error('invalid addressing mode for branch instruction: '+addressing_mode+', in line='+line);
          }

          emit(tryte);
          emit(rel_address);
        }
      } else {
        throw new Error(`unrecognized opcode: ${opcode}, in line=${line}`);
      }
    }

    // Resolve unresolved symbols, writing their values in the machine code
    for (let us of this.unresolved_symbols) {
      if (!this.symbols.has(us.symbol_name)) {
        throw new Error(`unresolved symbol ${us.symbol_name}, in line=${us.asm_line}`);
      }

      const resolved_value = this.symbols.get(us.symbol_name);
      this.validate_operand_range(resolved_value, us.addressing_mode, us.line);
      console.log(`resolved symbol ${us.symbol_name} to ${resolved_value} (${JSON.stringify(us)})`);

      if (us.addressing_mode === ADDR_MODE.IMMEDIATE) {
        output[us.code_address] = resolved_value;
      } else if (us.addressing_mode === ADDR_MODE.BRANCH_RELATIVE) {
        // special case of immediate - stored resolved_value is absolute; convert to relative
        let rel_address = resolved_value - (us.code_address + origin) - 1; // -1 for instruction
        if (rel_address < -121 || rel_address > 121) {
          throw new Error(`branch instruction to too-far absolute address: resolved_value=${resolved_value}, code_address=${us.code_address}, rel_address=${rel_address}, in line=${us.asm_line}`);
        }
        output[us.code_address] = rel_address;
      } else if (us.addressing_mode === ADDR_MODE.ABSOLUTE) {
        output[us.code_address] = low_tryte(resolved_value);
        output[us.code_address + 1] = high_tryte(resolved_value);
      } else {
        throw new Error(`unknown addressing mode ${us.addressing_mode} resolving ${us}`);
      }
    }

    console.log('assembled '+lines.length+' lines into '+output.length+' trytes');
    //console.log(output);
    return output;
  }

  parse_operand(operand, line, code_offset) {
    let addressing_mode;
    let operand_unresolved_at = undefined;

    if (operand === 'A') {
      addressing_mode = ADDR_MODE.ACCUMULATOR;
    } else {
      if (operand.charAt(0) === '#') {
        addressing_mode = ADDR_MODE.IMMEDIATE;
        operand = operand.substring(1);
      } else {
        addressing_mode = ADDR_MODE.ABSOLUTE;
      }

      switch(operand.charAt(0)) {
        case '%': // base 3, trits (%iiiii to %11111)
          operand = bts2n(operand.substring(1));
          break;
        case '$': // base 9, nonary ($imm to $144)
          operand = bts2n(nonary2bts(operand.substring(1)));
          break;
        case '&': // base 27, septemvigesimal (&QZ to &DM)
          operand = bts2n(sv2bts(operand.substring(1)));
          break;
        case "'": // trit-text character

          let unicode = operand.substring(1);

          // escapes for special characters
          if (unicode.substring(0, 1) === '\\') {
            switch(unicode.substring(1)) {
              case '\\':
                unicode = '\\';
                break;
              case 'n':
                unicode = '\n';
                break;
              case '0':
                unicode = '\0';
                break;
              case 's':
                unicode = ' ';
                break;
              case 'S':
                unicode = ';';
                break;
              default:
                throw new Error(`invalid trit-text escape character «${unicode}», in line=${line}`);
            }
          }

          operand = ttFromUnicode(unicode);
          if (operand === null || operand === undefined) {
            throw new Error(`invalid trit-text character «${unicode}», in line=${line})`);
          }
          break;

        default:
          if (operand.match(/^[-+]?[0-9]+$/)) {
            // decimal
            operand = Number.parseInt(operand, 10);
          } else {
            if (this.symbols.has(operand)) {
              operand = this.symbols.get(operand);
            } else {
              this.unresolved_symbols.push({
                code_address: code_offset + 1, // write right after opcode
                symbol_name: operand,
                addressing_mode: addressing_mode,
                asm_line: line,
              });
              console.log(`saving unresolved symbol ${operand} at ${code_offset}`);
              operand = 0;//61; // overwritten in second phase
              operand_unresolved_at = this.unresolved_symbols.length - 1; // index in unresolved_symbols
              //throw new Error('unresolved symbol reference: '+operand+', in line: '+line);
            }
          }
      }

      this.validate_operand_range(operand, addressing_mode, line);
    }

    return {addressing_mode, operand, operand_unresolved_at};
  }

  validate_operand_range(operand, addressing_mode, line) {
    if (addressing_mode === ADDR_MODE.IMMEDIATE) {
      if (operand < -121 || operand > 121) {
        throw new Error('immediate operand out of 5-trit range: '+operand+', in line: '+line);
      }
    } else if (addressing_mode === ADDR_MODE.ABSOLUTE) {
      // %iiiiiiiiii to %1111111111
      // $mmmmm to $44444
      // &NZZZ to &AMMM
      if (operand < -29524 || operand > 29524) {
        throw new Error('absolute operand out of 10-trit range: '+operand+', in line: '+line);
      }
    }
  }
}

function assemble(lines) {
  return new Assembler().assemble(lines);
}

module.exports = assemble;
