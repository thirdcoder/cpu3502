'use strict';

const {XOP, FLAGS} = require('./opcodes');
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

    case XOP.TSX: // X = S
      cpu.index = cpu.stackptr;
      cpu.alu.update_flags_from(cpu.index);
      break;

    case XOP.TXA: // A = X
      cpu.accum = cpu.index;
      cpu.alu.update_flags_from(cpu.accum);
      break;

    case XOP.TXS: // S = X
      cpu.stackptr = cpu.index;
      cpu.alu.update_flags_from(cpu.index);
      break;

    // halts - set H to halt code, set R to 0 to stop running
    case XOP.HALT_N:  // H=i, R=0
      cpu.set_flag(FLAGS.H, -1);
      cpu.set_flag(FLAGS.R, 0);
      break;
    case XOP.HALT_Z:  // H=0, R=0
      cpu.set_flag(FLAGS.H, 0);
      cpu.set_flag(FLAGS.R, 0);
      break;
    case XOP.HALT_P:  // H=1, R=0
      cpu.set_flag(FLAGS.H, 1);
      cpu.set_flag(FLAGS.R, 0);
      break;

    // math
    case XOP.INX:   // X = X+1
      cpu.index = inc(cpu.index);
      cpu.alu.update_flags_from(cpu.index);
      break;
  }
}

module.exports = execute_xop_instruction;
