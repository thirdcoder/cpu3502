'use strict';

const {bts2n, n2bts, N_TO_BT_DIGIT, BT_DIGIT_TO_N} = require('balanced-ternary');
const {get_trit, set_trit, slice_trits} = require('trit-getset');
const ttToUnicode = require('trit-text').toUnicode;

const {TRITS_PER_TRYTE, TRYTES_PER_WORD, TRITS_PER_WORD, MAX_TRYTE, MIN_TRYTE, MEMORY_SIZE} = require('./arch');

const {OP, ADDR_MODE, XOP, XOP_TO_ADDR_MODE_OP} = require('./opcodes');

const {decode_instruction, decode_operand, disasm1} = require('./instr_decode');
const ALU = require('./alu');
const Memory = require('./memory');
const Flags = require('./flags');
const execute_xop_instruction = require('./xop');
const Stack = require('./stack');

class CPU {
  constructor(opts={}) {
    this.memory = opts.memory || Memory({
      tryteCount: MEMORY_SIZE,
      map: opts.memoryMap || {}
    });
    this.pc = 0;
    this.accum = 0;
    this.index = 0;
    this.yindex = 0;
    this.flags = Flags();
    this.stack = Stack(this.memory);
    this.alu = ALU(this);

    this.flags.I = -1; // by default only allow int 0, non-maskable NMI/start

    console.log('initial flags=',n2bts(this.flags));
  }

  state_snapshot() {
    return {
      pc: this.pc,
      accum: this.accum,
      index: this.index,
      yindex: this.yindex,
      stackptr: this.stack.stackptr,
      flags: this.flags
    };
  }

  state_restore(state) {
    this.pc = state.pc;
    this.accum = state.accum;
    this.index = state.index;
    this.yindex = state.yindex;
    this.stack.stackptr = state.stackptr;
    this.flags = state.flags;
  }

  read_int_vector(intnum) {
    return this.memory.readWord(this.memory.minAddress + ((intnum + 1) * 2));
  }

  is_interrupt_allowed(intnum) {
    switch(this.flags.I) {
      case -1:
        // I=-1 allow only nonmaskable NMI interrupt 0 (start) (SEIN) (default)
        return intnum === 0;

      case 0:
        // I=0 allow all interrupts (CLI)
        return true;

      case 1:
        // I=1 allow interrupts -1 and 0, but mask 1 (SEIP)
        return intnum !== 1;
    }
  }

  interrupt(intnum, value) {
    console.log('interrupt',intnum,value);
    if (!this.is_interrupt_allowed(intnum)) {
      console.log(`interrupt ${intnum} masked by I=${this.flags.I}`);
      return;
    }

    const before = this.state_snapshot();

    // Read interrupt vector table at negative-most memory, word addresses pointers:
    // iiiii iiiii -29524 int -1
    // iiiii iiii0 -29523
    //
    // iiiii iiii1 -29522 int 0
    // iiiii iii0i -29521
    //
    // iiiii iii00 -29520 int +1
    // iiiii iii01 -29519
    const address = this.read_int_vector(intnum);
    console.log('interrupt vector address',address);

    if (address === 0) { // probably wrong
      debugger;
      throw new Error(`unset interrupt vector for ${intnum}`);
    }

    // Set accumulator to passed in value, used to send data from I/O
    // TODO: other registers? index, yindex, flags; optional. Or at least clear
    if (value !== undefined) this.accum = value;

    // Execute interrupt handler
    this.pc = address;
    this.run();

    // Restore previous state, except NMI/start interrupt, since it can set flags for other interrupt handlers
    if (intnum !== 0) this.state_restore(before);
  }

  execute_branch_instruction(flag, compare, direction, rel_address) {
    console.log(`compare flag=${flag}, direction=${direction}, compare=${compare}`);

    // compare (b) trit to compare flag with
    const flag_value = this.flags.get_flag(flag);

    // direction (c)
    // i less than (flag < trit)
    // 0 equal (flag = trit)
    // 1 not equal (flag != trit)
    let branch_taken = false;
    if (direction === -1) {
      branch_taken = flag_value < compare;
    } else if (direction === 0) {
      branch_taken = flag_value === compare;
    } else if (direction === 1) {
      branch_taken = flag_value !== compare;
    }

    console.log(`flag flag_value=${flag_value}, branch_taken=${branch_taken}, rel_address=${rel_address}`);

    // if matches, relative branch (+/- 121)
    if (branch_taken) {
      console.log('taking branch from',this.pc,'to',this.pc+rel_address);
      this.pc += rel_address;
    } else {
      console.log('not taking branch from',this.pc,'to',this.pc+rel_address);
    }
  }

  // Read instruction operand from decoded instruction, return read/write accessors
  read_alu_operand(di) {
    let read_arg, write_arg, address_of_arg;

    let decoded_operand = decode_operand(di, this.memory.subarray(this.pc), 0);

    this.pc += decoded_operand.consumed * this.flags.R;

    if ('absolute' in decoded_operand) {
      // absolute, 2-tryte address
      console.log('absolute',decoded_operand.absolute);

      read_arg = () => { return this.memory.read(decoded_operand.absolute); };
      write_arg = (x) => { return this.memory.write(decoded_operand.absolute, x); };
      address_of_arg = () => { return decoded_operand.absolute; };

    } else if ('accumulator' in decoded_operand) {
      // accumulator, register, no arguments
      read_arg = () => { return this.accum; };
      write_arg = (x) => { return (this.accum = x); };
      address_of_arg = () => { throw new Error(`cannot take address of accumulator, in instruction ${JSON.stringify(di)} at pc=${this.pc}`); };

      console.log('accum');

    } else if ('immediate' in decoded_operand) {
      // immediate, 1-tryte literal
      console.log('immediate',decoded_operand.immediate);

      read_arg = () => { return decoded_operand.immediate; };
      write_arg = () => { throw new Error(`cannot write to immediate: ${decoded_operand.immediate}, in instruction ${JSON.stringify(di)} at pc=${this.pc}`); };
      address_of_arg = () => { throw new Error(`cannot take address of immediate operand, in instruction ${JSON.stringify(di)} at pc=${this.pc}`); }; // actually, maybe can (code_offset)
    } else if ('indirect_indexed' in decoded_operand) {
      console.log('indirect_indexed',decoded_operand.indirect_indexed);

      address_of_arg = () => {
        // (indirect),Y
        let ptr = this.memory.readWord(decoded_operand.indirect_indexed);
        ptr += this.yindex;
        return ptr;
      };

      read_arg = () => { return this.memory.read(address_of_arg()); };
      write_arg = (x) => { return this.memory.write(address_of_arg(), x); }

    } else {
      read_arg = write_arg = address_of_arg = () => { throw new Error(`unimplemented addressing mode, in decoded=operand${JSON.stringify(di)}`); }
    }

    return {read_arg, write_arg, address_of_arg};
  }

  execute_next_instruction() {
    const opcode = this.memory.read(this.pc);
    console.log('\npc=',this.pc,' opcode=',opcode,'disasm=',disasm1(this.memory.subarray(this.pc)).asm);

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
      let {read_arg, write_arg, address_of_arg} = this.read_alu_operand(di);

      this.alu.execute_alu_instruction(di.operation, read_arg, write_arg);
    } else if (di.family === 1) {
      const rel_address = this.memory.read(this.pc += this.flags.R);

      this.execute_branch_instruction(di.flag, di.compare, di.direction, rel_address);
    } else if (di.family === -1) {
      let {read_arg, write_arg, address_of_arg} = this.read_alu_operand(di);

      if (XOP_TO_ADDR_MODE_OP[di.operation] !== undefined) {
        // alu operation, extended addressing mode in xop namespace
        const alu_op = XOP_TO_ADDR_MODE_OP[di.operation][0];
        this.alu.execute_alu_instruction(alu_op, read_arg, write_arg);
      } else {
        execute_xop_instruction(this, di.operation, read_arg, write_arg, address_of_arg);
      }
    }

    console.log('flags:','RHUVSDCIL');
    console.log('flags:',n2bts(this.flags.value), `A=${this.accum}(${ttToUnicode(this.accum)}), X=${this.index}, Y=${this.yindex}`);
  }

  step() {
    this.execute_next_instruction();
    this.pc += this.flags.R;
  }

  run() {
    this.flags.R = 1; // running: 1, program counter increments by; -1 runs backwards, 0 halts
    do {
      this.step();
    } while(this.flags.R !== 0);
    console.log('Halted with status',this.flags.H);
  }
}

module.exports = function(opts) {
  return new CPU(opts);
};

