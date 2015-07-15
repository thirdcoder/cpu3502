'use strict';

const {get_trit, set_trit, slice_trits} = require('trit-getset');
const {OP} = require('./opcodes');
const {bts2n, n2bts} = require('balanced-ternary');
const {TRITS_PER_TRYTE, TRYTES_PER_WORD, TRITS_PER_WORD, MAX_TRYTE, MIN_TRYTE, MEMORY_SIZE} = require('./arch');
const {NTI, STI, PTI, FD, RD, TOR, TAND, BUT} = require('tritwise');
const {add, inc, dec} = require('./arithmetic');
const {lst, shl, shr} = require('trit-shift');

class ALU {
  constructor(cpu) {
    this.cpu = cpu;
  }

  update_flags_from(value) {
    this.cpu.flags.L = lst(value); // L = least significant trit of A (also get_trit(value, 0))

    // set to most significant nonzero trit, or zero
    let sign;
    if (value < 0) sign = -1;
    else if (value === 0) sign = 0;
    else sign = 1;
    /*
    for (var i = TRITS_PER_TRYTE; i; --i) {
      sign = get_trit(value, i);
      if (sign !== 0) break;
    }
    */
    this.cpu.flags.S = sign;
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
        const result = add(this.cpu.accum, read_arg(), this.cpu.flags.C);

        this.cpu.accum = result.result;
        this.update_flags_from(this.cpu.accum);
        this.cpu.flags.V = result.overflow;
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

      // shifts
      case OP.SHL: { // C <-- arg <-- D     M = M<<<1 + D
        let value = read_arg();
        this.update_flags_from(write_arg(shl(value, this.cpu.flags.D)));
        this.cpu.flags.C = get_trit(value, TRITS_PER_TRYTE - 1);  // shifted-out trit, from left
        break;
      }

      case OP.SHR: { // C --> arg --> D     M = (C <<< 5) + M>>>1
        let value = read_arg();
        this.update_flags_from(write_arg(shr(value, TRITS_PER_TRYTE, this.cpu.flags.C)));
        this.cpu.flags.D = lst(value);  // shifted-out trit, from right
        break;
      }

      default:
        throw new Error('unimplemented alu instruction: '+operation);
    }

    console.log('A=',n2bts(this.cpu.accum));
  }
}

module.exports = ALU;
