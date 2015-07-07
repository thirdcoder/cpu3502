'use strict';

const {get_trit, set_trit, slice_trits} = require('trit-getset');
const {OP, FLAGS} = require('./opcodes');
const {bts2n, n2bts} = require('balanced-ternary');
const {TRITS_PER_TRYTE, TRYTES_PER_WORD, TRITS_PER_WORD, MAX_TRYTE, MIN_TRYTE, MEMORY_SIZE} = require('./arch');

class ALU {
  constructor(cpu) {
    this.cpu = cpu;
  }

  update_flags_from_accum() {
    this.cpu.set_flag(FLAGS.L, get_trit(this.cpu.accum, 0)); // L = least significant trit of A

    // set to most significant nonzero trit, or zero (TODO: optimize? since packed can really just check <0, >0,==0)
    var sign = 0;
    for (var i = TRITS_PER_TRYTE; i; --i) {
      sign = get_trit(this.cpu.accum, i);
      if (sign !== 0) break;
    }
    this.cpu.set_flag(FLAGS.S, sign);

    console.log('flags:','FHROS_CPL');
    console.log('flags:',n2bts(this.cpu.flags));
  }

  execute_alu_instruction(operation, read_arg, write_arg) {
    console.log('alu',n2bts(operation));
    // operation (aaa)
    // addressing mode

    switch(operation) {
      case OP.NOP:
        console.log('nop');
        break;

      case OP.STA:
        write_arg(this.cpu.accum);
        console.log('stored accum',this.cpu.accum);
        console.log('memory[0]=',this.cpu.memory[0]);
        break;

      case OP.STX:
        write_arg(this.cpu.index);
        break;

      case OP.LDA:
        this.cpu.accum = read_arg();
        console.log('load, accum=',this.cpu.accum);
        break;

      case OP.LDX:
        this.cpu.index = read_arg();
        break;
    }

    this.update_flags_from_accum();
  }
}

module.exports = ALU;
