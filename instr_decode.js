'use strict';

const {MAX_TRYTE, MIN_TRYTE, TRITS_PER_TRYTE} = require('./arch');
const {OP, ADDR_MODE, FLAGS, XOP} = require('./opcodes');
const {get_trit, slice_trits} = require('trit-getset');
const invertKv = require('invert-kv');

function decode_instruction(opcode) {
  const family = get_trit(opcode, 0);
  //console.log('family',family,n2bts(opcode));

  // 5-trit trytes
  // 43210
  // aaab0 aa=operation, b=addressing mode
  // aabc1 aa=flag, b=direction(i<, 0=,1!=), c=trit to compare with
  // aaaai other instructions

  if (family === 0) {
    const operation = slice_trits(opcode, 2, 5);
    const addressing_mode = get_trit(opcode, 1);

    return {family, operation, addressing_mode};
  } else if (family === 1) {
    const flag = slice_trits(opcode, 3, 5);
    const direction = get_trit(opcode, 2);
    const compare = get_trit(opcode, 1);

    return {family, flag, compare, direction};
  } else if (family === -1) {
    const operation = slice_trits(opcode, 1, 5);

    return {family, operation};
  }

  throw new Error('unable to decode instruction: '+op);
};

// Disassemble one instruction in machine_code
function disasm(machine_code) {
  let di = decode_instruction(machine_code[0]);

  let name;

  if (di.family === 0) {
    name = invertKv(OP)[di.operation]; // inefficient lookup, but probably doesn't matter
  } else if (di.family === 1) {
    name = 'BR';
    name += invertKv(FLAGS)[di.flag];
    // TODO
    name += {'-1':'L', 0:'E', 1:'N'}[di.direction];
    name += {'-1':'N', 0:'Z', 1:'P'}[di.compare];

  } else if (di.family === -1) {
    name = invertKv(XOP)[di.operation];
    // TODO: undefined opcodes
  }
  // TODO: operands

  return name;
}

module.exports = {
  decode_instruction,
  disasm,
};
