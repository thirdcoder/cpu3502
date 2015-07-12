'use strict';

const {MAX_TRYTE, MIN_TRYTE, TRITS_PER_TRYTE} = require('./arch');
const {ADDR_MODE} = require('./opcodes');
const {get_trit, slice_trits} = require('trit-getset');

function decode_instruction(opcode) {
  const family = get_trit(opcode, 0);
  //console.log('family',family,n2bts(opcode));

  // 5-trit trytes
  // 43210
  // aaab0 aa=operation, b=addressing mode
  // aabc1 aa=flag, b=compare with trit branch if c(i<, 0=, 1!=)
  // aaaai other instructions

  if (family === 0) {
    const operation = slice_trits(opcode, 2, 5);
    const addressing_mode = get_trit(opcode, 1);

    return {family, operation, addressing_mode};
  } else if (family === 1) {
    const flag = slice_trits(opcode, 3, 5);
    const compare = get_trit(opcode, 1);
    const direction = get_trit(opcode, 2);

    return {family, flag, compare, direction};
  } else if (family === -1) {
    const operation = slice_trits(opcode, 1, 5);

    return {family, operation};
  }

  throw new Error('unable to decode instruction: '+op);
};

module.exports = decode_instruction;
