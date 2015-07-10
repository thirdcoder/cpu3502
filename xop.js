'use strict';

const {XOP, FLAGS} = require('./opcodes');

function execute_xop_instruction(cpu, operation) {
  console.log('misc', operation);

  switch(operation) {
    // transfers
    case XOP.TAX:
      cpu.index = cpu.accum;
      cpu.alu.update_flags_from_accum();
      console.log('TAX index=',cpu.index);
      break;

    case XOP.TSX:
      cpu.index = cpu.stackptr;
      // TODO: flags from X?
      break;

    case XOP.TXA:
      cpu.accum = cpu.index;
      cpu.alu.update_flags_from_accum();
      break;

    case XOP.TXS:
      cpu.stackptr = cpu.index;
      break;

    // halts - set H to halt code, set R to 0 to stop running
    case XOP.HALT_N:
      cpu.set_flag(FLAGS.H, -1);
      cpu.set_flag(FLAGS.R, 0);
      break;
    case XOP.HALT_Z:
      cpu.set_flag(FLAGS.H, 0);
      cpu.set_flag(FLAGS.R, 0);
      break;
    case XOP.HALT_P:
      cpu.set_flag(FLAGS.H, 1);
      cpu.set_flag(FLAGS.R, 0);
      break;
  }
}

module.exports = execute_xop_instruction;
