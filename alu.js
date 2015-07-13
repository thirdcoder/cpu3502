'use strict';

const {get_trit, set_trit, slice_trits} = require('trit-getset');
const {OP, FLAGS} = require('./opcodes');
const {bts2n, n2bts} = require('balanced-ternary');
const {TRITS_PER_TRYTE, TRYTES_PER_WORD, TRITS_PER_WORD, MAX_TRYTE, MIN_TRYTE, MEMORY_SIZE} = require('./arch');
const {NTI, STI, PTI, FD, RD, TOR, TAND, BUT} = require('tritwise');
const {add, inc, dec} = require('./arithmetic');

class ALU {
  constructor(cpu) {
    this.cpu = cpu;
  }

  update_flags_from(value) {
    this.cpu.set_flag(FLAGS.L, get_trit(value, 0)); // L = least significant trit of A

    // set to most significant nonzero trit, or zero (TODO: optimize? since packed can really just check <0, >0,==0)
    var sign = 0;
    for (var i = TRITS_PER_TRYTE; i; --i) {
      sign = get_trit(value, i);
      if (sign !== 0) break;
    }
    this.cpu.set_flag(FLAGS.S, sign);

    console.log('flags:','FHRVSDCIL');
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

      case OP.STA:  // M = A
        write_arg(this.cpu.accum);
        break;

      case OP.STX:  // M = X
        write_arg(this.cpu.index);
        break;

      case OP.STY:  // M = Y
        write_arg(this.cpu.yindex);
        break;

      case OP.LDA:  // A = M
        this.cpu.accum = read_arg();
        this.update_flags_from(this.cpu.accum);
        break;

      case OP.LDX:  // X = M
        this.cpu.index = read_arg();
        this.update_flags_from(this.cpu.index);
        break;

      case OP.LDY:  // Y = M
        this.cpu.yindex = read_arg();
        this.update_flags_from(this.cpu.yindex);
        break;

      // unary functions TODO: how should these set flags?
      case OP.NTI: write_arg(NTI(read_arg())); break;
      case OP.STI: write_arg(STI(read_arg())); break;
      case OP.PTI: write_arg(PTI(read_arg())); break;
      case OP.FD:  write_arg( FD(read_arg())); break;
      case OP.RD:  write_arg( RD(read_arg())); break;

      case OP.ADC: {  // A = A+M+C
        const result = add(this.cpu.accum, read_arg(), this.cpu.get_flag(FLAGS.C));

        this.cpu.accum = result.result;
        this.update_flags_from(this.cpu.accum);
        this.cpu.set_flag(FLAGS.V, result.overflow);
        break;
      }

      case OP.INC:  // M = M+1
        this.update_flags_from(write_arg(inc(read_arg())));
        break;

      case OP.DEC:  // M = M-1
        this.update_flags_from(write_arg(dec(read_arg())));
        break;


      case OP.CMP:  //     A-M
        this.update_flags_from(this.cpu.accum - read_arg());
        break;

      case OP.CPX:  //     X-M
        this.update_flags_from(this.cpu.index - read_arg());
        break;

      case OP.CPY:  //     Y-M
        this.update_flags_from(this.cpu.yindex - read_arg());
        break;


      default:
        throw new Error('unimplemented alu instruction: '+operation);
    }

    console.log('A=',n2bts(this.cpu.accum));
  }
}

module.exports = ALU;
