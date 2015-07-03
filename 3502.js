'use strict';

const {bts2n, n2bts, N_TO_BT_DIGIT, BT_DIGIT_TO_N} = require('balanced-ternary');
const {get_trit, slice_trits} = require('trit-getset');

const {TRITS_PER_TRYTE, TRYTES_PER_WORD, TRITS_PER_WORD, MAX_TRYTE, MIN_TRYTE, MEMORY_SIZE} = require('./arch');

const OP = require('./opcodes');

let memory = new Int8Array(new ArrayBuffer(MEMORY_SIZE)); // Int8Array is 8-bit signed -129 to +128, fits 5-trit -121 to +121

let pc = 0;
let accum = 0;
let index = 0;
let flags = 0;
let halt = false; // TODO: move to flags, halt

const ADDR_MODE_ABSOLUTE = -1;
const ADDR_MODE_ACCUMULATOR = 0;
const ADDR_MODE_IMMEDIATE = 1;

function execute_alu_instruction(operation, addressing_mode) {
  console.log('alu',n2bts(operation), addressing_mode);
  // operation (aaa)
  // addressing mode
  
  let read_arg, write_arg;

  switch(addressing_mode) {
    // absolute, 2-tryte address
    case ADDR_MODE_ABSOLUTE:
      let absolute = memory[++pc];
      absolute += 3**TRITS_PER_TRYTE * memory[++pc];

      console.log('absolute',absolute);

      read_arg = function() { return memory[absolute]; };
      write_arg = function(x) { memory[absolute] = x; };

      break;


    // accumulator, register, no arguments
    case ADDR_MODE_ACCUMULATOR:

      read_arg = function() { return accum; };
      write_arg = function(x) { accum = x; };

      console.log('accum');

      break;

    // immediate, 1-tryte literal
    case ADDR_MODE_IMMEDIATE:
      let immediate = memory[++pc];

      console.log('immediate',immediate);

      read_arg = function() { return immediate; };
      write_arg = function() { throw new Error('cannot write to immediate: '+immediate); };

      break;


  }

  if (operation === OP.NOP) {
    console.log('nop');
  }
}

function execute_branch_instruction(flag, compare, direction) {
  console.log('compare',flag,compare,direction);

  // flag (aa) 9 trits
  // -4 ii N negative
  // -3 i0 - always i
  // -2 i1 + always 1
  // -1 0i U underflow
  //  0 00 Z zero
  // +1 01 O overflow
  // +2 1i D debug
  // +3 10 H halt
  // +4 11 V overflow
  
  // compare (b) trit to compare flag with
  // direction (c)
  // i less than (flag < trit)
  // 0 equal (flag = trit)
  // 1 greater than (flag > trit)
  //
  // if matches, relative branch (+/- 121)
}

const OP_HALT = bts2n('iiii');

// unary ternary functions (a.3.5) https://www.scribd.com/doc/78370674/Ternary-Computing-Testbed-3-Trit-Computer-Architecture
// tritwise operating on accumulator
const OP_NTI  = bts2n('000i'); // A: negative ternary inverter (tritwise i01 -> 1ii)
const OP_STI  = bts2n('0000'); // A: simple ternary inverter   (tritwise i01 -> 10i)
const OP_PTI  = bts2n('0001'); // A: positive ternary inverter (tritwise i01 -> 11i)
const OP_FD   = bts2n('001i'); // A: forward diode             (tritwise i01 -> 001)
const OP_RD   = bts2n('0010'); // A: reverse diode             (tritwise i01 -> i00)


function execute_misc_instruction(operation) {
  console.log('misc', operation);

  switch(operation) {
    case OP_HALT:
      console.log('HALT');
      halt = true;
      break;
  }

}

let x=0;
memory[x++] = bts2n('10i10'); // operation 10i, addressing mode 1
memory[x++] = bts2n('11001'); // flag 11, trit 0, compare 0
memory[x++] = bts2n('00000'); // nop a

memory[x++] = bts2n('00010'); // nop #-121
memory[x++] = bts2n('iiiii'); // #

memory[x++] = bts2n('000i0'); // nop 29524
memory[x++] = bts2n('11111'); // xx
memory[x++] = bts2n('11111'); // xx

memory[x++] = bts2n('iiiii'); // iiiii abort

console.log(bts2n('iiiii'));

do {
  let opcode = memory[pc];
  console.log('\npc=',pc,' opcode=',opcode);

  if (opcode === undefined) {
    // increase MEMORY_SIZE if running out too often
    throw new Error('program counter '+pc+' out of range into undefined memory');
  }
  if (opcode > MAX_TRYTE || opcode < MIN_TRYTE) {
    // indicates internal error in simulator, backing store shouldn't be written out of this range
    throw new Error('memory at pc='+pc+' value='+opcode+' out of 5-trit range');
  }

  let family = get_trit(opcode, 0);
  //console.log('family',family,n2bts(opcode));

  // 5-trit trytes
  // 43210
  // aaab0 aa=operation, b=addressing mode
  // aabc1 aa=flag, b=compare with trit branch if c(i<, 0=, 1>)
  // aaaai other instructions

  if (family === 0) {
    let operation = slice_trits(opcode, 2, 5);
    let addressing_mode = get_trit(opcode, 1);

    execute_alu_instruction(operation, addressing_mode);
  } else if (family === 1) {
    let flag = slice_trits(opcode, 3, 5);
    let compare = get_trit(opcode, 2);
    let direction = get_trit(opcode, 3);

    execute_branch_instruction(flag, compare, direction);
  } else if (family === -1) {
    let operation = slice_trits(opcode, 1, 5);

    execute_misc_instruction(operation);
  }

  ++pc;
} while(!halt);
