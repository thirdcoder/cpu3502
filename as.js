'use strict';

const {OP, ADDR_MODE, FLAGS, XOP} = require('./opcodes');
const {bts2n, n2bts, N_TO_BT_DIGIT, BT_DIGIT_TO_N} = require('balanced-ternary');
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

var lines = [
  'NTI #%11001',
  'NOP A',
  'NOP #-121',
  'NOP 29524',
  'BNE -1',
  'BEQ +2',
  'HALT_N',
  'HALT_P',
  'LDA #42',
  'STA 0',
  'HALT_Z'
  /*

    this.memory[x++] = bts2n('10i10'); // operation 10i, addressing mode 1
    this.memory[x++] = bts2n('11001'); // flag 11, trit 0, compare 0
    this.memory[x++] = bts2n('00000'); // nop a

    this.memory[x++] = bts2n('00010'); // nop #-121
    this.memory[x++] = bts2n('iiiii'); // #

    this.memory[x++] = bts2n('000i0'); // nop 29524
    this.memory[x++] = bts2n('11111'); // xx
    this.memory[x++] = bts2n('11111'); // xx

    this.memory[x++] = bts2n('00011'); // bne, not taken
    this.memory[x++] = bts2n('0000i'); //  relative branch destination, -1

    this.memory[x++] = bts2n('00001'); // beq (br s=0,branch if sign trit flag is zero, accumulator is zero)
    this.memory[x++] = bts2n('0001i'); //  relative branch destination, +2

    this.memory[x++] = bts2n('iiiii'); // iiiii halt i, skipped by above branch
    this.memory[x++] = bts2n('iii1i'); // iiiii halt 1, also skipped by same branch

    this.memory[x++] = bts2n('1ii10'); // lda #
    this.memory[x++] = bts2n('1iii0'); // #42

    this.memory[x++] = bts2n('011i0'); // sta 0
    this.memory[x++] = bts2n('00000'); // xx
    this.memory[x++] = bts2n('00000'); // xx

    this.memory[x++] = bts2n('iii0i'); // iiiii halt 0
*/
];

function emit(tryte) {
  console.log('emit',n2bts(tryte));
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
        case '%': // base 3, trits
          operand = bts2n(operand.substring(1));
          break;
        case '$': // TODO: base 9
        case '&': // TODO: base 27
        default:
          operand = Number.parseInt(operand, 10);
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
    //if (opcode === 'BNE') opcode = 'BRSNZ'; // TODO: not equal?? have >, <, =, but what about !=? (which is < or >). maybe change.. =, !=, something else(? <?)

    if (opcode.charAt(1) === 'R' && opcode.length === 5) {
      var flag = opcode.charAt(2);
      var direction = opcode.charAt(3);
      var compare = opcode.charAt(4);

      var flag_value = FLAGS[flag];
      if (flag_value === undefined) {
        throw new Error('invalid flag '+flag+' in branch instruction '+opcode);
      }
      var direction_value = {L:-1, E:0, G:1}[direction];
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

