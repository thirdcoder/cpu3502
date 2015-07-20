'use strict';

const {XOP} = require('./opcodes');
const {add, inc, dec} = require('./arithmetic');
const {TRITS_PER_TRYTE, T_TO_TRITS_PER_TRYTE} = require('./arch');
const {low_tryte, high_tryte, trytes2word} = require('./word');

function execute_xop_instruction(cpu, operation, read_arg, write_arg, address_of_arg) {
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

    case XOP.TSXY: // X,Y = S
      cpu.index = low_tryte(cpu.stack.stackptr);
      cpu.yindex = high_tryte(cpu.stack.stackptr);
      cpu.alu.update_flags_from(cpu.index);
      break;

    case XOP.TXYS: // S = X<<5 | Y
      cpu.stack.stackptr = trytes2word(cpu.yindex, cpu.index);
      // no flags affected
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

    case XOP.SEDN:  // I = i
      cpu.flags.I = -1;
      break;

    case XOP.SEDP:  // I = 1
      cpu.flags.I = 1;
      break;

    case XOP.CLD:   // D = 0
      cpu.flags.D = 0;
      break;

    case XOP.SEIN:  // D = i
      cpu.flags.D = -1;
      break;

    case XOP.SEIP:  // D = 1
      cpu.flags.D = 1;
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

    case XOP.NOP:
      break;

    // stack
    case XOP.PHA:   // push A
      cpu.stack.push(cpu.accum);
      break;

    case XOP.PHX:   // push X
      cpu.stack.push(cpu.index);
      break;

    case XOP.PHY:   // push Y
      cpu.stack.push(cpu.yindex);
      break;

    case XOP.PLA:   // pull A
      cpu.accum = cpu.stack.pull();
      break;

    case XOP.PLX:   // pull X
      cpu.index = cpu.stack.pull();
      break;

    case XOP.PLY:   // pull Y
      cpu.yindex = cpu.stack.pull();
      break;

    case XOP.PHP:   // push processor flags
      cpu.stack.pushWord(cpu.flags.value);
      break;

    case XOP.PLP:   // pull processor flags
      cpu.flags.value = cpu.stack.pullWord();
      break;

    case XOP.STZ_ABY:
    case XOP.STZ_ABS:   // store zero
    case XOP.STZ_IIY:
      write_arg(0);
      break;

    // jump
    case XOP.JMP_ABS:   // pc = absolute
      cpu.pc = address_of_arg();
      --cpu.pc; // undo next-instruction increment
      console.log(`jumped to ${cpu.pc}`);
      break;

    case XOP.JMP_INDIR:   // pc = (indirect)
      cpu.pc = address_of_arg();
      --cpu.pc;
      console.log(`jumped indirectly to ${cpu.pc}`);
      break;

    case XOP.JSR: { // push pc; pc = absolute
      const callsite = cpu.pc;
      cpu.stack.pushWord(callsite);

      cpu.pc = address_of_arg();
      --cpu.pc;
      console.log(`jumped to subroutine ${cpu.pc}, from callsite ${callsite}`);
      break;
    }

    case XOP.RTS: { // pull pc
      const callsite = cpu.stack.pullWord();

      console.log(`returning to subroutine callsite ${callsite}`);

      cpu.pc = callsite;
      break;
    }

    case XOP.RTI:   // return from interrupt
      cpu.flags.R = 0;
      // TODO: pull from stack, right now just halts, due to interrupt() calling cpu.run()
      break;


    default:
      throw new Error(`unimplemented xop opcode: ${operation}`);
  }
}

module.exports = execute_xop_instruction;
