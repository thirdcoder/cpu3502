'use strict';

const {OP, ADDR_MODE, FLAGS, BRANCH_INSTRUCTION_ALIASES, XOP} = require('./opcodes');
const {bts2n, n2bts, N_TO_BT_DIGIT, BT_DIGIT_TO_N} = require('balanced-ternary');
const {nonary2bts} = require('nonary');
const {sv2bts} = require('base27');
const {get_trit, slice_trits} = require('trit-getset');

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

function assemble(lines) {
  // TODO: port to run on cpu (self-hosting)
  let output = [];

  let codeOffset = 0; // always start at zero TODO: .org, start assembly

  let emit = function(tryte) {
    console.log('emit',n2bts(tryte));
    output.push(tryte);
    ++codeOffset;
  }

  let symbols = new Map();


  for (let line of lines) {
    if (line.endsWith(':')) {
      // labels TODO: support other instructions on line
      const label = line.substring(0, line.length - 1);
      if (symbols.has(label)) {
        throw new Error(`label symbol redefinition: ${label}, in line=${line}`);
      }
      symbols.set(label, codeOffset); // use emitted code length TODO: code assembly offset (0 ok?)
      continue;
    }
    // TODO: comments, ; to end-of-line

    let tokens = line.split(/\s+/);
    let opcode = tokens[0];
    let operand = tokens[1];
    let addressing_mode;

    if (operand !== undefined) {

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
          // TODO: ' for trit-text characters

          default:
            if (operand.match(/^[-+]?[0-9]+$/)) {
              // decimal
              operand = Number.parseInt(operand, 10);
            } else {
              if (symbols.has(operand)) {
                operand = symbols.get(operand);
              } else {
                throw new Error('undefined symbol reference: '+operand+', in line: '+line);
              }
            }
        }

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

    console.log(tokens,operand);

    if (opcode.charAt(0) === '.') {
      // assembler directives
      opcode = opcode.substring(1);

      if (opcode === 'equ') {
        let name = tokens[2];
        if (name === undefined) {
          throw new Error('.equ directive requires name, in line: '+line);
        }

        if (symbols.has(name)) {
          throw new Error('symbol redefinition: '+name+', in line: '+line);
        }

        symbols.set(name, operand);
        console.log(`assigned symbol ${name} to ${operand}`);
      }
    } else if (OP[opcode] !== undefined) {
      // alu
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
          emit(slice_trits(operand, 0, 5));
          emit(slice_trits(operand, 5, 10));
          break;
      }
    } else if (XOP[opcode] !== undefined) {
      let opcode_value = XOP[opcode]; // aaaai 4-trits

      let tryte = opcode_value * Math.pow(3,1) + (-1);
      emit(tryte);
    } else if (opcode.charAt(0) === 'B') {
      // TODO: branch, beq (s=0), bne (s!=0) br s>0, s=0, s<0 brsen brgz brlp
      // convenience aliases
      if (BRANCH_INSTRUCTION_ALIASES[opcode]) opcode = BRANCH_INSTRUCTION_ALIASES[opcode];

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
            // given absolute address, need to compute relative to current location for instruction encoding
            // -2 to account for size of the branch instruction (opcode+operand) itself
            rel_address = operand - codeOffset - 2;

            if (rel_address < -121 || rel_address > 121) {
              throw new Error(`branch instruction to too-far absolute address: operand=${operand}, codeOffset=${codeOffset}, rel_address=${rel_address}, in line=${line}`);
            }

            break;

          default:
            throw new Error('invalid addressing mode for branch instruction: '+addressing_mode+', in line='+line);
        }

        emit(tryte);
        emit(rel_address);
      }
    }
  }

  console.log('assembled '+lines.length+' lines into '+output.length+' trytes');
  console.log(output);
  return output;
}

module.exports = assemble;
