'use strict';

const {OP, ADDR_MODE, FLAGS, XOP} = require('./opcodes');
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
  var output = [];

  var emit = function(tryte) {
    console.log('emit',n2bts(tryte));
    output.push(tryte);
  }


  for (var line of lines) {
    var tokens = line.split(/\s+/);
    var opcode = tokens[0];
    var operand = tokens[1];

    if (operand !== undefined) {
      var addressing_mode;

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

          default:
            operand = Number.parseInt(operand, 10);
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

    console.log(tokens,opcode_value,operand);

    if (OP[opcode] !== undefined) {
      // alu
      var opcode_value = OP[opcode]; // aaab0 3-trits

      var tryte = opcode_value * Math.pow(3,2) +
        addressing_mode * Math.pow(3,1) +
        0;

      emit(tryte);

      switch(addressing_mode) {
        case ADDR_MODE.IMMEDIATE:
          emit(operand);
          break;

        case ADDR_MODE.ABSOLUTE:
          // TODO: endian?
          emit(slice_trits(operand, 0, 5));
          emit(slice_trits(operand, 5, 10));
          break;
      }
    } else if (XOP[opcode] !== undefined) {
      var opcode_value = XOP[opcode]; // aaaai 4-trits

      var tryte = opcode_value * Math.pow(3,1) + (-1);
      emit(tryte);
    } else if (opcode.charAt(0) === 'B') {
      // TODO: branch, beq (s=0), bne (s!=0) br s>0, s=0, s<0 brsen brgz brlp
      if (opcode === 'BEQ') opcode = 'BRSEZ'; // branch if equal = branch if sign equal to zero
      if (opcode === 'BNE') opcode = 'BRSNZ'; // branch if not equal = branch if sign not equal to zero

      if (opcode.charAt(1) === 'R' && opcode.length === 5) {
        var flag = opcode.charAt(2);
        var direction = opcode.charAt(3);
        var compare = opcode.charAt(4);

        var flag_value = FLAGS[flag];
        if (flag_value === undefined) {
          throw new Error('invalid flag '+flag+' in branch instruction '+opcode);
        }
        var direction_value = {
          L:-1, '<':-1,
          E:0, '=':0,
          N:1, '!':1
        }[direction];
        if (direction_value === undefined) {
          throw new Error('invalid direction '+direction+' in branch instruction '+opcode);
        }
        var compare_value = {N:-1, Z:0, P:1}[compare];
        if (compare_value === undefined) {
          throw new Error('invalid comparison trit '+compare_value+' in branch instruction '+opcode);
        }
        console.log('branch',flag_value,direction_value,compare_value);

        // aabc1 a=flag, b=trit for comparison, c=direction
        var tryte = flag_value * Math.pow(3,3) +
          compare_value * Math.pow(3,2) +
          direction_value * Math.pow(3,1) +
          1;
        emit(tryte);
        emit(operand);
      }
    }
  }

  console.log('assembled '+lines.length+' lines into '+output.length+' trytes');
  return output;
}

module.exports = assemble;
