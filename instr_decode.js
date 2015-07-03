'use strict';

const {MAX_TRYTE, MIN_TRYTE, TRITS_PER_TRYTE} = require('./arch');
const {ADDR_MODE} = require('./opcodes');
const {get_trit, slice_trits} = require('trit-getset');

function read_alu_operand(memory, pc, step, addressing_mode) {
  let read_arg, write_arg;

  switch(addressing_mode) {
    // absolute, 2-tryte address
    case ADDR_MODE.ABSOLUTE:
      let absolute = memory[pc += step];
      absolute += 3**TRITS_PER_TRYTE * memory[pc += step];

      console.log('absolute',absolute);

      read_arg = function() { return memory[absolute]; };
      write_arg = function(x) { memory[absolute] = x; };

      break;

    // accumulator, register, no arguments
    case ADDR_MODE.ACCUMULATOR:

      read_arg = function() { return accum; };
      write_arg = function(x) { accum = x; };

      console.log('accum');

      break;

    // immediate, 1-tryte literal
    case ADDR_MODE.IMMEDIATE:
      let immediate = memory[pc += step];

      console.log('immediate',immediate);

      read_arg = function() { return immediate; };
      write_arg = function() { throw new Error('cannot write to immediate: '+immediate); };

      break;
  }

  return [read_arg, write_arg, pc];
}

function decode_next_instruction(memory, pc, step, handlers) {
  const opcode = memory[pc];
  console.log('\npc=',pc,' opcode=',opcode);

  if (opcode === undefined) {
    // increase MEMORY_SIZE if running out too often
    throw new Error('program counter '+pc+' out of range into undefined memory');
  }
  if (opcode > MAX_TRYTE || opcode < MIN_TRYTE) {
    // indicates internal error in simulator, backing store shouldn't be written out of this range
    throw new Error('memory at pc='+pc+' value='+opcode+' out of 5-trit range');
  }

  const family = get_trit(opcode, 0);
  //console.log('family',family,n2bts(opcode));

  // 5-trit trytes
  // 43210
  // aaab0 aa=operation, b=addressing mode
  // aabc1 aa=flag, b=compare with trit branch if c(i<, 0=, 1>)
  // aaaai other instructions

  if (family === 0) {
    const operation = slice_trits(opcode, 2, 5);
    const addressing_mode = get_trit(opcode, 1);
    let read_arg, write_arg;
    [read_arg, write_arg, pc] = read_alu_operand(memory, pc, step, addressing_mode);

    handlers.execute_alu_instruction(operation, read_arg, write_arg);
  } else if (family === 1) {
    const flag = slice_trits(opcode, 3, 5);
    const compare = get_trit(opcode, 1);
    const direction = get_trit(opcode, 2);

    const rel_address = memory[pc += step];

    pc = handlers.execute_branch_instruction(flag, compare, direction, rel_address, pc);
  } else if (family === -1) {
    const operation = slice_trits(opcode, 1, 5);

    handlers.execute_misc_instruction(operation);
  }
  return pc;
};

module.exports = decode_next_instruction;
