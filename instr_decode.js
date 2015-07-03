'use strict';

const {MAX_TRYTE, MIN_TRYTE, TRITS_PER_TRYTE} = require('./arch');
const {ADDR_MODE} = require('./opcodes');
const {get_trit, slice_trits} = require('trit-getset');

function read_alu_operand(cpu, addressing_mode) {
  let read_arg, write_arg;

  switch(addressing_mode) {
    // absolute, 2-tryte address
    case ADDR_MODE.ABSOLUTE:
      let absolute = cpu.advance_memory();
      absolute += 3**TRITS_PER_TRYTE * cpu.advance_memory(); // TODO: endian?

      console.log('absolute',absolute);

      read_arg = function() { return cpu.memory[absolute]; };
      write_arg = function(x) { cpu.memory[absolute] = x; };

      break;

    // accumulator, register, no arguments
    case ADDR_MODE.ACCUMULATOR:

      read_arg = function() { return cpu.accum; };
      write_arg = function(x) { cpu.accum = x; };

      console.log('accum');

      break;

    // immediate, 1-tryte literal
    case ADDR_MODE.IMMEDIATE:
      let immediate = cpu.advance_memory();

      console.log('immediate',immediate);

      read_arg = function() { return immediate; };
      write_arg = function() { throw new Error('cannot write to immediate: '+immediate); };

      break;
  }

  return [read_arg, write_arg];
}

function decode_next_instruction(cpu) {
  const opcode = cpu.memory[cpu.pc];
  console.log('\npc=',cpu.pc,' opcode=',opcode);

  if (opcode === undefined) {
    // increase MEMORY_SIZE if running out too often
    throw new Error('program counter '+cpu.pc+' out of range into undefined memory');
  }
  if (opcode > MAX_TRYTE || opcode < MIN_TRYTE) {
    // indicates internal error in simulator, backing store shouldn't be written out of this range
    throw new Error('memory at pc='+cpu.pc+' value='+opcode+' out of 5-trit range');
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
    [read_arg, write_arg] = read_alu_operand(cpu, addressing_mode);

    cpu.execute_alu_instruction(operation, read_arg, write_arg);
  } else if (family === 1) {
    const flag = slice_trits(opcode, 3, 5);
    const compare = get_trit(opcode, 1);
    const direction = get_trit(opcode, 2);

    const rel_address = cpu.advance_memory();

    cpu.pc = cpu.execute_branch_instruction(flag, compare, direction, rel_address, cpu.pc);
  } else if (family === -1) {
    const operation = slice_trits(opcode, 1, 5);

    cpu.execute_misc_instruction(operation);
  }
};

module.exports = decode_next_instruction;
