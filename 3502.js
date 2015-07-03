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

function read_alu_operand(addressing_mode) {
  let read_arg, write_arg;

  switch(addressing_mode) {
    // absolute, 2-tryte address
    case ADDR_MODE.ABSOLUTE:
      let absolute = memory[pc += get_flag(FLAGS.R)];
      absolute += 3**TRITS_PER_TRYTE * memory[pc += get_flag(FLAGS.R)];

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
      let immediate = memory[pc += get_flag(FLAGS.R)];

      console.log('immediate',immediate);

      read_arg = function() { return immediate; };
      write_arg = function() { throw new Error('cannot write to immediate: '+immediate); };

      break;
  }

  return {read_arg, write_arg};
}

function execute_alu_instruction(operation, read_arg, write_arg) {
  console.log('alu',n2bts(operation));
  // operation (aaa)
  // addressing mode

  switch(operation) {
    case OP.NOP:
      console.log('nop');
      break;

    case OP.STA:
      write_arg(accum);
      console.log('stored accum',accum);
      console.log('memory[0]=',memory[0]);
      break;

    case OP.LDA:
      accum = read_arg();
      console.log('load, accum=',accum);
      break;
  }

  update_flags_from_accum();
}

// get a flag trit value given FLAGS.foo
function get_flag(flag) {
  let flag_index = flag + 4; // -4..4 to 0..8
  let flag_value = get_trit(flags, flag_index);

  return flag_value;
}

function set_flag(flag, value) {
  let flag_index = flag + 4; // -4..4 to 0..8

  flags = set_trit(flags, flag_index, value);
}

function update_flags_from_accum() {
  set_flag(FLAGS.L, get_trit(accum, 0)); // L = least significant trit of A

  // set to most significant nonzero trit, or zero (TODO: optimize? since packed can really just check <0, >0,==0)
  var sign = 0;
  for (var i = TRITS_PER_TRYTE; i; --i) {
    sign = get_trit(accum, i);
    if (sign !== 0) break;
  }
  set_flag(FLAGS.S, sign);

  console.log('flags:','FHROS_CPL');
  console.log('flags:',n2bts(flags));
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
  let rel_address = memory[pc += get_flag(FLAGS.R)];

  console.log('flag',flag_value,branch_taken,rel_address);

  if (branch_taken) {
    console.log('taking branch from',pc,'to',pc+rel_address);
    pc += rel_address;
  } else {
    console.log('not taking branch from',pc,'to',pc+rel_address);
  }
}

function execute_misc_instruction(operation) {
  console.log('misc', operation);

  switch(operation) {
    // halts - set H to halt code, set R to 0 to stop running
    case XOP.HALT_N:
      set_flag(FLAGS.H, -1);
      set_flag(FLAGS.R, 0);
      break;
    case XOP.HALT_Z:
      set_flag(FLAGS.H, 0);
      set_flag(FLAGS.R, 0);
      break;
    case XOP.HALT_P:
      set_flag(FLAGS.H, 1);
      set_flag(FLAGS.R, 0);
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

memory[x++] = bts2n('iiiii'); // iiiii halt i, skipped by above branch
memory[x++] = bts2n('iii1i'); // iiiii halt 1, also skipped by same branch

memory[x++] = bts2n('1ii10'); // lda #
memory[x++] = bts2n('1iii0'); // #42

memory[x++] = bts2n('011i0'); // sta 0
memory[x++] = bts2n('00000'); // xx
memory[x++] = bts2n('00000'); // xx

memory[x++] = bts2n('iii0i'); // iiiii halt 0

set_flag(FLAGS.F, -1); // fixed value
set_flag(FLAGS.R, 1); // running: 1, program counter increments by; -1 runs backwards, 0 halts

console.log('initial flags=',n2bts(flags));

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
    const operation = slice_trits(opcode, 2, 5);
    const addressing_mode = get_trit(opcode, 1);
    const {read_arg, write_arg} = read_alu_operand(addressing_mode);

    execute_alu_instruction(operation, read_arg, write_arg);
  } else if (family === 1) {
    let flag = slice_trits(opcode, 3, 5);
    let compare = get_trit(opcode, 1);
    let direction = get_trit(opcode, 2);

    execute_branch_instruction(flag, compare, direction);
  } else if (family === -1) {
    let operation = slice_trits(opcode, 1, 5);

    execute_misc_instruction(operation);
  }

  pc += get_flag(FLAGS.R);
} while(get_flag(FLAGS.R) !== 0);
console.log('Halted with status',get_flag(FLAGS.H));
