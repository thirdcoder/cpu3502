'use strict';

const {XOP} = require('./opcodes');
const {add, inc, dec} = require('./arithmetic');

function execute_xop_instruction(cpu, operation) {
  console.log('misc', operation);

  switch(operation) {
    // transfers
    case XOP.TAX: // X = A
      cpu.index = cpu.accum;
      cpu.alu.update_flags_from(cpu.accum);
      console.log('TAX index=',cpu.index);
      break;

    case XOP.TAY: // Y = A
      cpu.yindex = cpu.accum;
      cpu.alu.update_flags_from(cpu.yindex);
      break;

    case XOP.TXA: // A = X
      cpu.accum = cpu.index;
      cpu.alu.update_flags_from(cpu.accum);
      break;

    case XOP.TYA: // A = Y
      cpu.accum = cpu.yindex;
      cpu.alu.update_flags_from(cpu.accum);
      break;

    // halts - set H to halt code, set R to 0 to stop running
    case XOP.HALTN:  // H=i, R=0
      cpu.flags.H = -1;
      cpu.flags.R = 0;
      break;
    case XOP.HALTZ:  // H=0, R=0
      cpu.flags.H = 0;
      cpu.flags.R = 0;
      break;
    case XOP.HALTP:  // H=1, R=0
      cpu.flags.H = 1;
      cpu.flags.R = 0;
      break;

    // arithmetic
    case XOP.INX:   // X = X+1
      cpu.index = inc(cpu.index);
      cpu.alu.update_flags_from(cpu.index);
      break;

    case XOP.INY:   // Y = Y+1
      cpu.yindex = inc(cpu.yindex);
      cpu.alu.update_flags_from(cpu.yindex);
      break;

    case XOP.DEX:   // X = X-1
      cpu.index = dec(cpu.index);
      cpu.alu.update_flags_from(cpu.index);
      break;

    case XOP.DEY:   // Y = Y-1
      cpu.yindex = dec(cpu.yindex);
      cpu.alu.update_flags_from(cpu.yindex);
      break;

    // flags
    case XOP.CLC:   // C = 0
      cpu.flags.C = 0;
      break;

    case XOP.CLI:   // I = 0
      cpu.flags.I = 0;
      break;

    case XOP.CLV:   // V = 0
      cpu.flags.V = 0;
      break;

    case XOP.SECP:  // C = 1
      cpu.flags.C = 1;
      break;

    case XOP.SECN:  // C = i
      cpu.flags.C = -1;
      break;

    case XOP.SEIN:  // I = i
      cpu.flags.I = -1;
      break;

    case XOP.SEIP:  // I = 1
      cpu.flags.I = 1;
      break;

    // interrupts
    case XOP.INTN:  // int i
      cpu.interrupt(-1);
      break;

    case XOP.INTZ:  // int 0
      cpu.interrupt(0);
      break;

    case XOP.INTP:  // int 1
      cpu.interrupt(1);
      break;

    case XOP.BRK:
      debugger;
      break;
  }
}

module.exports = execute_xop_instruction;
