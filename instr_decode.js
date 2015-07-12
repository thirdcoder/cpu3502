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

  let opcode, operand;

  if (di.family === 0) {
    opcode = invertKv(OP)[di.operation]; // inefficient lookup, but probably doesn't matter

    // note: some duplication with cpu read_alu_operand TODO: factor out
    // TODO: handle reading beyond end
    switch(di.addressing_mode) {
      // absolute, 2-tryte address
      case ADDR_MODE.ABSOLUTE:
        let absolute = machine_code[1];
        absolute += 3**TRITS_PER_TRYTE * machine_code[2]; // TODO: endian?

        operand = absolute.toString(); // decimal address
        //operand = '%' + n2bts(absolute); // base 3 trits TODO: what base to defalt to? 3, 9, 27, 10??
        break;

      // accumulator, register, no arguments
      case ADDR_MODE.ACCUMULATOR:
        operand = 'A';
        break;

      // immediate, 1-tryte literal
      case ADDR_MODE.IMMEDIATE:
        let immediate = machine_code[1];
        operand = '#' + '%' + n2bts(immediate); // TODO: again, what base?
        break;
    }

  } else if (di.family === 1) {
    opcode = 'BR';
    opcode += invertKv(FLAGS)[di.flag];
    // TODO
    opcode += {'-1':'L', 0:'E', 1:'N'}[di.direction];
    opcode += {'-1':'N', 0:'Z', 1:'P'}[di.compare];

    operand = machine_code[1].toString();
    if (machine_code[1] > 0) {
      // always add +, since makes relativity clearer
      operand = '+' + machine_code[1].toString();
    } else {
      operand = machine_code[1].toString();
    }

  } else if (di.family === -1) {
    opcode = invertKv(XOP)[di.operation];
    // TODO: undefined opcodes
  }

  let asm;

  if (operand !== undefined) {
    asm = opcode + ' ' + operand;
  } else {
    asm = opcode;
  }

  return asm;
}

module.exports = {
  decode_instruction,
  disasm,
};
