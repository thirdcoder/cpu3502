'use strict';

const {bts2n, n2bts, N_TO_BT_DIGIT, BT_DIGIT_TO_N} = require('balanced-ternary');
const {get_trit, set_trit, slice_trits} = require('trit-getset');

const {TRITS_PER_TRYTE, TRYTES_PER_WORD, TRITS_PER_WORD, MAX_TRYTE, MIN_TRYTE, MEMORY_SIZE} = require('./arch');

const {OP, ADDR_MODE, FLAGS, XOP} = require('./opcodes');

const decode_next_instruction = require('./instr_decode');

let memory = new Int8Array(new ArrayBuffer(MEMORY_SIZE)); // Int8Array is 8-bit signed -129 to +128, fits 5-trit -121 to +121

let pc = 0;
let accum = 0;
let index = 0;
let flags = 0;

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

function execute_branch_instruction(flag, compare, direction, rel_address, pc) {
  console.log('compare',flag,compare,direction);

  // compare (b) trit to compare flag with
  const flag_value = get_flag(flag);

  // direction (c)
  // i less than (flag < trit)
  // 0 equal (flag = trit)
  // 1 greater than (flag > trit)
  let branch_taken = false;
  if (direction < 0) {
    branch_taken = flag_value < compare;
  } else if (direction === 0) {
    branch_taken = flag_value === compare;
  } else if (direction > 0) {
    branch_taken = flag_value > compare;
  }

  console.log('flag',flag_value,branch_taken,rel_address);

  // if matches, relative branch (+/- 121)
  if (branch_taken) {
    console.log('taking branch from',pc,'to',pc+rel_address);
    pc += rel_address;
  } else {
    console.log('not taking branch from',pc,'to',pc+rel_address);
  }

  return pc;
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

const handlers = {
  execute_alu_instruction,
  execute_branch_instruction,
  execute_misc_instruction
};

do {
  pc = decode_next_instruction(memory, pc, get_flag(FLAGS.R), handlers);

  pc += get_flag(FLAGS.R);
} while(get_flag(FLAGS.R) !== 0);
console.log('Halted with status',get_flag(FLAGS.H));
