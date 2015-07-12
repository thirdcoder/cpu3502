'use strict';

const {bts2n, n2bts, N_TO_BT_DIGIT, BT_DIGIT_TO_N} = require('balanced-ternary');
const {get_trit, set_trit, slice_trits} = require('trit-getset');

const {TRITS_PER_TRYTE, TRYTES_PER_WORD, TRITS_PER_WORD, MAX_TRYTE, MIN_TRYTE, MEMORY_SIZE} = require('./arch');

const {OP, ADDR_MODE, FLAGS, XOP} = require('./opcodes');

const {decode_instruction, decode_operand, disasm1} = require('./instr_decode');
const ALU = require('./alu');
const execute_xop_instruction = require('./xop');

class CPU {
  constructor() {
    this.memory = new Int8Array(new ArrayBuffer(MEMORY_SIZE)); // Int8Array is 8-bit signed -129 to +128, fits 5-trit -121 to +121
    this.pc = 0;
    this.accum = 0;
    this.index = 0;
    this.stackptr = 0;
    this.flags = 0;

    this.set_flag(FLAGS.F, -1); // fixed value
    this.set_flag(FLAGS.R, 1); // running: 1, program counter increments by; -1 runs backwards, 0 halts

    this.alu = new ALU(this);

    console.log('initial flags=',n2bts(this.flags));
  }

  writeTrytes(address, data) {
    let i = address;
    for(let tryte of data) {
      this.memory[i++] = tryte;
    }
  }

  // get a flag trit value given FLAGS.foo
  get_flag(flag) {
    let flag_index = flag + 4; // -4..4 to 0..8
    let flag_value = get_trit(this.flags, flag_index);

    return flag_value;
  }

  set_flag(flag, value) {
    let flag_index = flag + 4; // -4..4 to 0..8

    this.flags = set_trit(this.flags, flag_index, value);
  }

  execute_alu_instruction(operation, read_arg, write_arg) {
    this.alu.execute_alu_instruction(operation, read_arg, write_arg);
  }

  execute_branch_instruction(flag, compare, direction, rel_address) {
    console.log('compare',flag,compare,direction);

    // compare (b) trit to compare flag with
    const flag_value = this.get_flag(flag);

    // direction (c)
    // i less than (flag < trit)
    // 0 equal (flag = trit)
    // 1 not equal (flag != trit)
    let branch_taken = false;
    if (direction < 0) {
      branch_taken = flag_value < compare;
    } else if (direction === 0) {
      branch_taken = flag_value === compare;
    } else if (direction > 0) {
      branch_taken = flag_value !== compare;
    }

    console.log('flag',flag_value,branch_taken,rel_address);

    // if matches, relative branch (+/- 121)
    if (branch_taken) {
      console.log('taking branch from',this.pc,'to',this.pc+rel_address);
      this.pc += rel_address;
    } else {
      console.log('not taking branch from',this.pc,'to',this.pc+rel_address);
    }
  }

  execute_xop_instruction(operation) {
    execute_xop_instruction(this, operation);
  }

  advance_memory() {
    return this.memory[this.pc += this.get_flag(FLAGS.R)];
  }

  // Read instruction operand from decoded instruction, return read/write accessors
  read_alu_operand(di) {
    let read_arg, write_arg;

    let decoded_operand = decode_operand(di, this.memory, this.pc);

    this.pc += decoded_operand.consumed * this.get_flag(FLAGS.R);

    if ('absolute' in decoded_operand) {
      // absolute, 2-tryte address
      console.log('absolute',decoded_operand.absolute);

      read_arg = () => { return this.memory[decoded_operand.absolute]; };
      write_arg = (x) => { this.memory[decoded_operand.absolute] = x; };

    } else if ('accumulator' in decoded_operand) {
      // accumulator, register, no arguments
      read_arg = () => { return this.accum; };
      write_arg = (x) => { this.accum = x; };

      console.log('accum');

    } else if ('immediate' in decoded_operand) {
      // immediate, 1-tryte literal
      console.log('immediate',decoded_operand.immediate);

      read_arg = () => { return decoded_operand.immediate; };
      write_arg = () => { throw new Error('cannot write to immediate: '+decoded_operandimmediate); };
    }

    return [read_arg, write_arg];
  }

  execute_next_instruction() {
    const opcode = this.memory[this.pc];
    console.log('\npc=',this.pc,' opcode=',opcode,'disasm=',disasm1(this.memory,this.pc).asm);

    if (opcode === undefined) {
      // increase MEMORY_SIZE if running out too often
      throw new Error('program counter '+this.pc+' out of range into undefined memory');
    }
    if (opcode > MAX_TRYTE || opcode < MIN_TRYTE) {
      // indicates internal error in simulator, backing store shouldn't be written out of this range
      throw new Error('memory at pc='+this.pc+' value='+opcode+' out of 5-trit range');
    }

    const di = decode_instruction(opcode);

    if (di.family === 0) {
      let read_arg, write_arg;
      [read_arg, write_arg] = this.read_alu_operand(di);

      this.execute_alu_instruction(di.operation, read_arg, write_arg);
    } else if (di.family === 1) {
      const rel_address = this.advance_memory();

      this.execute_branch_instruction(di.flag, di.compare, di.direction, rel_address);
    } else if (di.family === -1) {
      this.execute_xop_instruction(di.operation);
    }
  }

  step() {
    this.execute_next_instruction();
    this.pc += this.get_flag(FLAGS.R);
  }

  run() {
    do {
      this.step();
    } while(this.get_flag(FLAGS.R) !== 0);
    console.log('Halted with status',this.get_flag(FLAGS.H));
  }
}

module.exports = function(opts) {
  return new CPU(opts);
};

