'use strict';

const OP = {
  // shifts
  SHL: -13, // iii shift left (like ASL arithmetic shift left) = multiplication by power of three
  ROL: -12, // ii0 rotate left
  ROR: -11, // ii1 rotate right
  LSR: -10, // i0i shift right (logical) = division by by power of three

  // indexing
  STX: -9, // i00 store X
  LDX: -8, // i01 load X

  // ternary dyadic functions
  BUT: -7, // i1i pref-0i1, BUT                                f i0i,000,i01
  ORA: -6, // i10 pref-10i, TOR,  maximum, ↑ U+2191, ∨ U+2228, f i01,001,111
  AND: -5, // i11 pref-i01, TAND, minimum, ↓ U+2193, ∧ U+2227, f iii,i00,i01
  EOR: -4, // 0ii exclusive max ⇑ U+2d1                        f i01,0i1,11i

  CPX: -3, // 0i0 compare index
  TRI: -2, // 0i1 tritmask, like 6502 BIT

  // increment/no-op/decrement
  DEC: -1, // 00i decrement
  NOP: 0,  // 000 no operation
  INC: 1,  // 001 increment

  JMP: 2, // 01i jump

  // arithmetic
  ADC: 3, // 010 add with carry
  STA: 4, // 011 store accumulator
  LDA: 5, // 1ii load accumulator
  CMP: 6, // 1i0 compare
  SBC: 7, // 1i1 subtract borrow carry

  // unary ternary functions (a.3.5) https://www.scribd.com/doc/78370674/Ternary-Computing-Testbed-3-Trit-Computer-Architecture
  NTI: 8, // 10i negative ternary inverter (tritwise i01 -> 1ii)
  STI: 9, // 100 simple ternary inverter   (tritwise i01 -> 10i)
  PTI:10, // 101 positive ternary inverter (tritwise i01 -> 11i)
  FD: 11, // 11i forward diode             (tritwise i01 -> 001)
  RD: 12, // 110 reverse diode             (tritwise i01 -> i00)

  uuu:13  // 111
};

const ADDR_MODE = {
  ABSOLUTE: -1,
  ACCUMULATOR: 0,
  IMMEDIATE: 1
};

const FLAGS = {
  // flag (aa) 9 trits
  L: -4, // -4 ii L least significant trit of A (if 0, divisible by 3)
  P: -3, // -3 i0 P parity, sum of all trits in A
  C: -2, // -2 i1 C carry
  D: -1, // -1 0i D dead zero
  S:  0, //  0 00 S sign, set to first nonzero trit of A (i=negative, 1=positive, or 0 if 0)
  V:  1, // +1 01 V overflow/underflow
  R:  2, // +2 1i R running, 1 when executing forward, i backwards, 0 halted
  H:  3, // +3 10 H halt code
  F:  4, // +4 11 F fixed to -1
};

const BRANCH_INSTRUCTION_ALIASES = {
  // generic branch instruction format is BR<flag><operation><compare-trit>
  //  flag: code from FLAGS
  //  operation: L=less than, E=equal, N=not equal
  //  compare-trit: N=-1, Z=0, P=1
  BEQ: 'BRSEZ', // branch if equal = branch if sign equal to zero
  BNE: 'BRSNZ', // branch if not equal = branch if sign not equal to zero
  BMI: 'BRSEN', // branch if minus = branch if sign equal to negative
  BPL: 'BRSEP', // branch if positive = branch if sign equal to positive
  BVC: 'BRVEZ', // branch if overflow clear = branch if overflow equal to zero
  BVS: 'BRVNZ', // branch if overflow set = branch if overflow nonzero
};

const XOP = {

  TAX: 1,       // 0001 transfer accumulator to index
  TSX: 2,       // 001i transfer stack pointer to index
  TXA: 3,       // 0010 transfer index to accumulator
  TXS: 4,       // 0011 transfer index to stack pointer

  INX: 5,       // 01ii increment index

  HALT_P: -38,  // iii1 halt positive
  HALT_Z: -39,  // iii0 halt zero
  HALT_N: -40,  // iiii halt negative
};

module.exports = {
  OP,
  ADDR_MODE,
  FLAGS,
  BRANCH_INSTRUCTION_ALIASES,
  XOP
};
