'use strict';

const {OP, ADDR_MODE, FLAGS, INSTRUCTION_ALIASES, XOP, XOP_REQUIRES_OPERAND, OP_ADDR_MODE_TO_XOP} = require('./opcodes');
const {bts2n, n2bts, N_TO_BT_DIGIT, BT_DIGIT_TO_N} = require('balanced-ternary');
const {nonary2bts} = require('nonary');
const {sv2bts} = require('base27');
const {get_trit} = require('trit-getset');
const {high_tryte, low_tryte} = require('./word');
const ttFromUnicode = require('trit-text').fromUnicode;

// assembler
// TODO: port to run on cpu (self-hosting)

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
    this.code_offset = 0;
    this.origin = 0;
    this.output = [];
    this.current_line = undefined;
  }

  add_symbol(name, value) {
    if (this.symbols.has(name)) {
      throw new Error(`symbol redefinition: ${name}, in line=${this.current_line}`); // TODO: store and log original symbol location
    }

    this.symbols.set(name, value);
    // also add low and high trytes (5-trit), useful for immediate mode, registers
    this.symbols.set('<' + name, low_tryte(value));
    this.symbols.set('>' + name, high_tryte(value));
    // TODO: also support arbitrary (but constant-foldable) expressions on symbols, e.g. name+1
  }

  emit(tryte) {
    console.log('emit',n2bts(tryte));
    this.output.push(tryte);
    ++this.code_offset;
  }

  emit_operand(operand_value, addressing_mode) {
    switch(addressing_mode) {
      case ADDR_MODE.ACCUMULATOR:
        // nothing to emit
        break;

      case ADDR_MODE.IMMEDIATE:
        if (!Number.isInteger(operand_value)) {
          throw new Error(`opcode (immediate) requires operand: ${operand_value}, in line: ${this.current_line}`);
        }

        this.emit(operand_value);
        break;

      case ADDR_MODE.ABSOLUTE:
      case ADDR_MODE.ABSOLUTE_X:
      case ADDR_MODE.ABSOLUTE_Y:
      case ADDR_MODE.INDEXED_X_INDIRECT:
      case ADDR_MODE.INDIRECT_INDEXED_Y:
        if (!Number.isInteger(operand_value)) {
          throw new Error(`opcode (2-tryte) requires operand: ${operand_value}, in line: ${this.current_line}`);
        }

        // TODO: endian?
        this.emit(low_tryte(operand_value));
        this.emit(high_tryte(operand_value));
        break;

      default:
        // TODO: more addressing modes
        throw new Error(`opcode unsupported addressing mode ${addressing_mode} for operand ${operand_value}, in line: ${this.current_line}`);
    }
  }

  assemble_line(line) {
    this.current_line = line;

    if (line.endsWith(':')) {
      // labels TODO: support other instructions on line
      const label = line.substring(0, line.length - 1);
      this.add_symbol(label, this.origin + this.code_offset);
      return;
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

    let addressing_mode, extra, operand_unresolved_at, operand_value;

    if (opcode.charAt(0) === '.') {
      // assembler directives
      opcode = opcode.substring(1);

      if (opcode === 'equ') {
        // .equ value name
        // TODO: reverse
        let name;
        let operand;
        if (rest.indexOf(' ') !== -1) {
          name = rest.substr(rest.indexOf(' ') + 1);
          operand = rest.substr(0, rest.indexOf(' '));
        } else {
          operand = rest;
        }

        ({addressing_mode, operand_value, operand_unresolved_at} = this.parse_operand(operand));

        this.add_symbol(name, operand_value);
        console.log(`assigned symbol ${name} to ${operand}`);
      } else if (opcode === 'org') {
        ({addressing_mode, operand_value, operand_unresolved_at} = this.parse_operand(rest));
        // TODO: do not allow unresolved symbols in .org?

        if (operand_value === undefined) throw new Error('.org directive requires operand, in line: '+line);
        this.origin = operand_value;
      } else if (opcode === 'word') {
        ({addressing_mode, operand_value, operand_unresolved_at} = this.parse_operand(rest, 0)); // 'opcode' size is 0

        if (operand_value === undefined) throw new Error('.word directive requires operand, in line: '+line);
        this.validate_operand_range(operand_value, ADDR_MODE.ABSOLUTE);
        this.emit(low_tryte(operand_value));
        this.emit(high_tryte(operand_value));
      } else if (opcode === 'tryte') {
        ({addressing_mode, operand_value, operand_unresolved_at} = this.parse_operand(rest, 0)); // 'opcode' size is 0

        if (operand_value === undefined) throw new Error('.tryte directive requires operand, in line: '+line);
        this.validate_operand_range(operand_value, ADDR_MODE.IMMEDIATE);
        this.emit(operand_value);
      } else if (opcode === 'data') {
        // only string literals for now, TODO
        if (!rest.startsWith('"') || !rest.endsWith('"')) throw new Error(`.data directive requires double-quoted string, in line=${line}`);
        const text = rest.substring(1, rest.length - 1);
        for (const char of text) {
          // TODO: support escape codes, same as character literals below
          // TODO: and maybe raw digits "foobar",0, with any kind of literals. like '.db', but not data bytes; rather, trytes. it's all .data
          const tt = ttFromUnicode(char);
          if (tt === null || tt === undefined) throw new Error(`invalid trit-text character «${char}» in string literal, in line=${line}`);
          this.emit(tt);
        }
        return;
      } else {
        throw new Error(`unrecognized assembler directive ${opcode}, in line=${line}`);
      }
    } else if (OP[opcode] !== undefined) {
      // alu

      if (rest === undefined) {
        throw new Error(`alu opcode ${opcode} requires operand, in line=${line}`);
      }

      let tryte;

      ({addressing_mode, operand_value, operand_unresolved_at} = this.parse_operand(rest));
      if ([ADDR_MODE.ABSOLUTE, ADDR_MODE.IMMEDIATE, ADDR_MODE.ACCUMULATOR].indexOf(addressing_mode) !== -1) {
        // the alu instruction encoding format supports these three modes
        let opcode_value = OP[opcode]; // aaab0 3-trits

        tryte = opcode_value * Math.pow(3,2) +
          addressing_mode * Math.pow(3,1) +
          0;
      } else {
        // xops to support additional addressing modes

        if (OP_ADDR_MODE_TO_XOP[opcode] === undefined) {
          throw new Error(`alu opcode ${opcode} operand unexpected addressing mode, requires absolute/immediate/accumulator, in line=${line}`);
        }

        if (OP_ADDR_MODE_TO_XOP[opcode][addressing_mode] === undefined) {
          throw new Error(`alu opcode ${opcode} operand unsupported addressing mode, in line=${line}`);
        }

        let opcode_value = OP_ADDR_MODE_TO_XOP[opcode][addressing_mode];
        tryte = opcode_value * Math.pow(3,1) + (-1);
      }

      this.emit(tryte);
      this.emit_operand(operand_value, addressing_mode);
    } else if (XOP[opcode] !== undefined) {
      let opcode_value = XOP[opcode]; // aaaai 4-trits

      let tryte = opcode_value * Math.pow(3,1) + (-1);

      let expected_addressing_mode = XOP_REQUIRES_OPERAND[opcode]; // only one addr mode per xop opcode TODO
      if (expected_addressing_mode !== undefined) {
        if (rest === undefined) {
          throw new Error(`xop opcode ${opcode} requires operand, in line=${ine}`);
        }

        ({addressing_mode, operand_value, operand_unresolved_at} = this.parse_operand(rest));
        if (addressing_mode !== expected_addressing_mode) {
          throw new Error(`xop opcode unexpected addressing mode, want ${expected_addressing_mode} but given ${addressing_mode}, in line=${this.current_line}`);
        }
      } else {
        if (rest !== undefined) {
          throw new Error(`xop opcode unexpected operand ${rest}, in line=${line}`);
        }
      }
      this.emit(tryte);
      if (XOP_REQUIRES_OPERAND[opcode] !== undefined) this.emit_operand(operand_value, addressing_mode);
    } else if (opcode.charAt(0) === 'B') {
      ({addressing_mode, operand_value, operand_unresolved_at} = this.parse_operand(rest));

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
            rel_address = operand_value;
            break;

          case ADDR_MODE.ABSOLUTE:
            if (operand_unresolved_at !== undefined) {
              // use current code placeholder to satisfy range check (rel=0
              operand_value = this.code_offset + this.origin + 2;
              // patch relative address from resolved absolute address
              this.unresolved_symbols[operand_unresolved_at].addressing_mode = ADDR_MODE.BRANCH_RELATIVE;
            }

            // given absolute address, need to compute relative to current location for instruction encoding
            // -2 to account for size of the branch instruction (opcode+operand) itself
            rel_address = operand_value - (this.code_offset + this.origin) - 2;

            if (rel_address < -121 || rel_address > 121) {
              throw new Error(`branch instruction to too-far absolute address: operand_value=${operand_value} (unresolved? ${operand_unresolved_at}), code_offset=${this.code_offset}, rel_address=${rel_address}, in line=${line}`);
            }

            break;

          default:
            throw new Error('invalid addressing mode for branch instruction: '+addressing_mode+', in line='+line);
        }

        this.emit(tryte);
        this.emit(rel_address);
      }
    } else {
      throw new Error(`unrecognized opcode: ${opcode}, in line=${line}`);
    }
  }

  assemble(lines) {
    this.output = []; // TODO: allow appending?

    this.code_offset = 0;
    this.origin = 0;

    for (let line of lines)
      this.assemble_line(line);

    this.resolve_unresolved_symbols();

    console.log('assembled '+lines.length+' lines into '+this.output.length+' trytes');
    //console.log(output);
    return this.output;
  }

  resolve_unresolved_symbols() {
    // Resolve unresolved symbols, writing their values in the machine code
    for (let us of this.unresolved_symbols) {
      if (!this.symbols.has(us.symbol_name)) {
        throw new Error(`unresolved symbol ${us.symbol_name}, in line=${us.asm_line}`);
      }

      const resolved_value = this.symbols.get(us.symbol_name);
      this.validate_operand_range(resolved_value, us.addressing_mode, us.line);
      console.log(`resolved symbol ${us.symbol_name} to ${resolved_value} (${JSON.stringify(us)})`);

      if (us.addressing_mode === ADDR_MODE.IMMEDIATE) {
        this.output[us.code_address] = resolved_value;
      } else if (us.addressing_mode === ADDR_MODE.BRANCH_RELATIVE) {
        // special case of immediate - stored resolved_value is absolute; convert to relative
        let rel_address = resolved_value - (us.code_address + this.origin) - 1; // -1 for instruction
        if (rel_address < -121 || rel_address > 121) {
          throw new Error(`branch instruction to too-far absolute address: resolved_value=${resolved_value}, code_address=${us.code_address}, rel_address=${rel_address}, in line=${us.asm_line}`);
        }
        this.output[us.code_address] = rel_address;
      } else if ([ADDR_MODE.ABSOLUTE, ADDR_MODE.ABSOLUTE_X, ADDR_MODE.ABSOLUTE_Y, ADDR_MODE.INDIRECT_INDEXED_Y].indexOf(us.addressing_mode) !== -1) {
        this.output[us.code_address] = low_tryte(resolved_value);
        this.output[us.code_address + 1] = high_tryte(resolved_value);
      } else {
        throw new Error(`unknown addressing mode ${us.addressing_mode} resolving ${us}`);
      }
    }
  }

  parse_literal(operand) {
    let operand_value;

    switch(operand.charAt(0)) {
      case '%': // base 3, trits (%iiiii to %11111)
        operand_value = bts2n(operand.substring(1));
        break;
      case '$': // base 9, nonary ($imm to $144)
        operand_value = bts2n(nonary2bts(operand.substring(1)));
        break;
      case '&': // base 27, septemvigesimal (&QZ to &DM)
        operand_value = bts2n(sv2bts(operand.substring(1)));
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
              throw new Error(`invalid trit-text escape character «${unicode}», in line=${this.current_line}`);
          }
        }

        operand_value = ttFromUnicode(unicode);
        if (operand_value === null || operand_value === undefined) {
          throw new Error(`invalid trit-text character «${unicode}», in line=${this.current_line})`);
        }
        break;

      default:
        if (operand.match(/^[-+]?[0-9]+$/)) {
          // decimal
          operand_value = Number.parseInt(operand, 10);
        } else {
          // not a literal!
          return undefined;
        }
      }
    return operand_value;
  }

  // Lookup a symbol from the symbol table and return value, or add as pending unresolved
  get_symbol(operand, addressing_mode, opcode_size) {
    let operand_value, operand_unresolved_at;

    if (this.symbols.has(operand)) {
      operand_value = this.symbols.get(operand);
    } else {
      this.unresolved_symbols.push({
        code_address: this.code_offset + opcode_size, // write right after opcode
        symbol_name: operand,
        addressing_mode: addressing_mode,
        asm_line: this.current_line,
      });
      console.log(`saving unresolved symbol ${operand} at ${this.code_offset}`);
      operand_value = 0;//61; // overwritten in second phase TODO: placebo?
      operand_unresolved_at = this.unresolved_symbols.length - 1; // index in unresolved_symbols
      //throw new Error('unresolved symbol reference: '+operand+', in line: '+this.current_line);
    }

    return {operand_value, operand_unresolved_at};
  }

  parse_operand(operand, opcode_size=1) {
    let addressing_mode;
    let operand_unresolved_at = undefined;
    let operand_value;

    if (operand === 'A') {
      addressing_mode = ADDR_MODE.ACCUMULATOR;
    } else {
      if (operand.charAt(0) === '#') {
        addressing_mode = ADDR_MODE.IMMEDIATE;
        operand = operand.substring(1);
      } else if (operand.charAt(0) === '(') {
        if (operand.endsWith(',X)')) {
          addressing_mode = ADDR_MODE.INDEXED_X_INDIRECT;
          operand = operand.substring(1, operand.length - ',X)'.length);
        } else if (operand.endsWith(')')) {
          addressing_mode = ADDR_MODE.INDIRECT;
          operand = operand.substring(1, operand.length - ')'.length);
        } else if (operand.endsWith('),Y')) {
          addressing_mode = ADDR_MODE.INDIRECT_INDEXED_Y;
          operand = operand.substring(1, operand.length - '),Y'.length);
        } else {
          throw new Error(`invalid indirect operand parsing ${operand}, in line=${this.current_line}`);
        }
      } else {
        if (operand.endsWith(',X')) {
          addressing_mode = ADDR_MODE.ABSOLUTE_X;
          operand = operand.substring(0, operand.length - ',X'.length);
        } else if (operand.endsWith(',Y')) {
          addressing_mode = ADDR_MODE.ABSOLUTE_Y;
          operand = operand.substring(0, operand.length - ',Y'.length);
        } else {
          addressing_mode = ADDR_MODE.ABSOLUTE;
        }
      }

      operand_value = this.parse_literal(operand);

      if (operand_value === undefined) {
        ({operand_value, operand_unresolved_at} = this.get_symbol(operand, addressing_mode, opcode_size));
      }

      this.validate_operand_range(operand_value, addressing_mode);
    }

    return {addressing_mode, operand_value, operand_unresolved_at};
  }

  validate_operand_range(operand, addressing_mode) {
    if (addressing_mode === ADDR_MODE.IMMEDIATE) {
      if (operand < -121 || operand > 121) {
        throw new Error('immediate operand out of 5-trit range: '+operand+', in line: '+this.current_line);
      }
    } else if (addressing_mode === ADDR_MODE.ABSOLUTE) {
      // %iiiiiiiiii to %1111111111
      // $mmmmm to $44444
      // &NZZZ to &AMMM
      if (operand < -29524 || operand > 29524) {
        throw new Error('absolute operand out of 10-trit range: '+operand+', in line: '+this.current_line);
      }
    }
  }
}

function assemble(lines) {
  return new Assembler().assemble(lines);
}
assemble.Assembler = Assembler;

module.exports = assemble;
