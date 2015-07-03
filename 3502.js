'use strict';

const {bts2n, n2bts, N_TO_BT_DIGIT, BT_DIGIT_TO_N} = require('balanced-ternary');
const {get_trit, set_trit, slice_trits} = require('trit-getset');

const {TRITS_PER_TRYTE, TRYTES_PER_WORD, TRITS_PER_WORD, MAX_TRYTE, MIN_TRYTE, MEMORY_SIZE} = require('./arch');

const {OP, ADDR_MODE, FLAGS, XOP} = require('./opcodes');

let memory = new Int8Array(new ArrayBuffer(MEMORY_SIZE)); // Int8Array is 8-bit signed -129 to +128, fits 5-trit -121 to +121

let pc = 0;
let accum = 0;
let index = 0;
let flags = 0;
let halt = undefined; // TODO: move to flags, halt

function execute_alu_instruction(operation, addressing_mode) {
  console.log('alu',n2bts(operation), addressing_mode);
  // operation (aaa)
  // addressing mode
  
  let read_arg, write_arg;

  switch(addressing_mode) {
    // absolute, 2-tryte address
    case ADDR_MODE.ABSOLUTE:
      let absolute = memory[++pc];
      absolute += 3**TRITS_PER_TRYTE * memory[++pc];

      console.log('absolute',absolute);

      read_arg = function() { return memory[absolute]; };
      write_arg = function(x) { memory[absolute] = x; };

      break;


    // accumulator, register, no arguments
    case ADDR_MODE.ACCUMULATOR:

      read_arg = function() { return accum; };
      write_arg = function(x) { accum = x; };

      console.log('accum');

      break;

    // immediate, 1-tryte literal
    case ADDR_MODE.IMMEDIATE:
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

// get a flag trit value given FLAGS.foo
function get_flag(flag) {
  let flag_index = flag + 4; // -4..4 to 0..8
  let flag_value = get_trit(flags, flag_index);

  return flag_value;
}

function set_flag(flag, value) {
  let flag_index = flag + 4; // -4..4 to 0..8

  set_trit(flags, flag_index, value);
}

function execute_branch_instruction(flag, compare, direction) {
  console.log('compare',flag,compare,direction);

  // compare (b) trit to compare flag with
  let flag_value = get_flag(flag);

  // direction (c)
  // i less than (flag < trit)
  // 0 equal (flag = trit)
  // 1 greater than (flag > trit)
  var branch_taken = false;
  if (direction < 0) {
    branch_taken = flag_value < compare;
  } else if (direction === 0) {
    branch_taken = flag_value === compare;
  } else if (direction > 0) {
    branch_taken = flag_value > compare;
  }

  // if matches, relative branch (+/- 121)
  let rel_address = memory[++pc];

  console.log('flag',flag_value,branch_taken,rel_address);

  if (branch_taken) {
    console.log('taking branch from',pc,'to',pc+rel_address);
    pc += rel_address;
    --pc; // undo ++pc increment in post-executing all instructions
  } else {
    console.log('not taking branch from',pc,'to',pc+rel_address);
  }
}

function execute_misc_instruction(operation) {
  console.log('misc', operation);

  switch(operation) {
    case XOP.HALT_N:
      halt = -1;
      break;
    case XOP.HALT_Z:
      halt = 0;
      break;
    case XOP.HALT_P:
      halt = 1;
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

memory[x++] = bts2n('00011'); // bne, not taken
memory[x++] = bts2n('0000i'); //  relative branch destination, -1

memory[x++] = bts2n('00001'); // beq (br s=0,branch if sign trit flag is zero, accumulator is zero)
memory[x++] = bts2n('0001i'); //  relative branch destination, +2

memory[x++] = bts2n('iiiii'); // iiiii halt i
memory[x++] = bts2n('iii0i'); // iiiii halt 0
memory[x++] = bts2n('iii1i'); // iiiii halt 1

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
    let compare = get_trit(opcode, 1);
    let direction = get_trit(opcode, 2);

    execute_branch_instruction(flag, compare, direction);
  } else if (family === -1) {
    let operation = slice_trits(opcode, 1, 5);

    execute_misc_instruction(operation);
  }

  ++pc;
} while(halt === undefined);
console.log('Halted with status',halt);
