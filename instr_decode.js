'use strict';

const {MAX_TRYTE, MIN_TRYTE, TRITS_PER_TRYTE, T_TO_TRITS_PER_TRYTE} = require('./arch');
const {OP, ADDR_MODE, FLAGS, XOP, XOP_REQUIRES_OPERAND, XOP_TO_ADDR_MODE_OP} = require('./opcodes');
const {get_trit, slice_trits} = require('trit-getset');
const invertKv = require('invert-kv');
const {n2bts}  = require('balanced-ternary');

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

    const addressing_mode = XOP_REQUIRES_OPERAND[invertKv(XOP)[operation]];
    if (addressing_mode !== undefined) {
      return {family, operation, addressing_mode};
    }

    return {family, operation};
  }

  throw new Error('unable to decode instruction: '+op);
};

// Read operands from a decoded instruction start at machine_code[offset] (offset=opcode)
function decode_operand(di, machine_code, offset=0) {
  const addressing_mode = di.addressing_mode;
  let consumed = 0;
  let value;

  switch(di.addressing_mode) {
    // 2-tryte operands
    case ADDR_MODE.INDIRECT_INDEXED_Y:
    case ADDR_MODE.INDEXED_X_INDIRECT:
    case ADDR_MODE.ABSOLUTE:
    case ADDR_MODE.ABSOLUTE_X:
    case ADDR_MODE.ABSOLUTE_Y:
      value = machine_code[offset + 1];
      value += T_TO_TRITS_PER_TRYTE * machine_code[offset + 2];
      consumed = 2;
      break;

    // accumulator, register, no arguments
    case ADDR_MODE.ACCUMULATOR:
      consumed = 0;
      break;

    // immediate, 1-tryte literal
    case ADDR_MODE.IMMEDIATE:
      value = machine_code[offset + 1];
      consumed = 1;
      break;
  }

  return {addressing_mode, value, consumed};
}

function stringify_operand(decoded_operand) {
  let operand;

  switch(decoded_operand.addressing_mode) {
    case ADDR_MODE.ABSOLUTE:
      operand = decoded_operand.value.toString(); // decimal address
      //operand = '%' + n2bts(absolute); // base 3 trits TODO: what base to defalt to? 3, 9, 27, 10??
      break;

    case ADDR_MODE.ACCUMULATOR:
      operand = 'A';
      break;

    case ADDR_MODE.IMMEDIATE:
      operand = '#' + '%' + n2bts(decoded_operand.value); // TODO: again, what base?
      break;

    case ADDR_MODE.INDIRECT_INDEXED_Y:
      operand = '(' + decoded_operand.value.toString() + '),Y';
      break;

    case ADDR_MODE.INDEXED_X_INDIRECT:
      operand = '(' + decoded_operand.value.toString() + ',X)';
      break;

    case ADDR_MODE.ABSOLUTE_X:
      operand = decoded_operand.value.toString() + ',X';
      break;

    case ADDR_MODE.ABSOLUTE_Y:
      operand = decoded_operand.value.toString() + ',Y';
      break;

    case ADDR_MODE.INDIRECT:
      operand = '(' + decoded_operand.value.toString() + ')';
      break;

    default:
      operand = undefined;
  }

  return operand;
}

// Disassemble one instruction in machine_code
function disasm1(machine_code, offset=0) {
  let di = decode_instruction(machine_code[offset]);

  let opcode, operand;
  let consumed = 1; // 1-tryte opcode, incremented later if operands

  if (di.family === 0) {
    opcode = invertKv(OP)[di.operation]; // inefficient lookup, but probably doesn't matter

    // note: some duplication with cpu read_alu_operand TODO: factor out
    // TODO: handle reading beyond end
    let decoded_operand = decode_operand(di, machine_code, offset);
    operand = stringify_operand(decoded_operand);
    consumed += decoded_operand.consumed;
  } else if (di.family === 1) {
    opcode = 'BR';
    opcode += invertKv(FLAGS)[di.flag];
    // TODO
    opcode += {'-1':'L', 0:'E', 1:'N'}[di.direction];
    opcode += {'-1':'N', 0:'Z', 1:'P'}[di.compare];

    let rel_address = machine_code[offset + 1];
    if (rel_address === undefined) {
      operand = '???'
    } else {
      if (rel_address > 0) {
        // always add +, since makes relativity clearer
        operand = '#+' + rel_address.toString();
      } else {
        operand = '#' + rel_address.toString();
      }
    }

    consumed += 1;
  } else if (di.family === -1) {
    opcode = invertKv(XOP)[di.operation];
    // TODO: undefined opcodes

    let decoded_operand = decode_operand(di, machine_code, offset);
    operand = stringify_operand(decoded_operand);
    consumed += decoded_operand.consumed;

    if (XOP_TO_ADDR_MODE_OP[di.operation] !== undefined) {
      // some extended opcodes can disassemble to alu special addressing modes
      opcode = invertKv(OP)[XOP_TO_ADDR_MODE_OP[di.operation][0]];
    }
  }

  let asm;

  if (operand !== undefined) {
    asm = opcode + ' ' + operand;
  } else {
    asm = opcode;
  }

  return {asm, consumed};
}

function disasm(machine_code) {
  let offset = 0;
  let asms= [];

  do {
    let {asm, consumed} = disasm1(machine_code, offset);
    asms.push(asm);
    offset += consumed;
  } while(offset < machine_code.length);

  return asms;
}

module.exports = {
  decode_instruction,
  decode_operand,
  disasm1,
  disasm,
};
