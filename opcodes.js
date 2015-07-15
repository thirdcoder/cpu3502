'use strict';

const OP = {
  // shifts
  SHL: -13, // iii shift left (like ASL, arithmetic shift left) = multiply by three + D
  ROL: -12, // ii0 rotate left
  ROR: -11, // ii1 rotate right
  SHR: -10, // i0i shift right = division by by power of three

  // indexing
  STX: -9, // i00 store X
  LDX: -8, // i01 load X

  // ternary dyadic functions
  BUT: -7, // i1i pref-0i1, BUT                                f i0i,000,i01
  ORA: -6, // i10 pref-10i, TOR,  maximum, ↑ U+2191, ∨ U+2228, f i01,001,111
  AND: -5, // i11 pref-i01, TAND, minimum, ↓ U+2193, ∧ U+2227, f iii,i00,i01
  EOR: -4, // 0ii exclusive max ⇑ U+2d1                        f i01,0i1,11i

  STY: -3, // 0i0 store Y
  LDY: -2, // 0i1 load Y

  // increment/no-op/decrement
  DEC: -1, // 00i decrement
  NOP: 0,  // 000 no operation
  INC: 1,  // 001 increment

  CPX: 2,  // 01i compare X

  // arithmetic
  ADC: 3, // 010 add with carry
  STA: 4, // 011 store accumulator
  LDA: 5, // 1ii load accumulator
  CMP: 6, // 1i0 compare A
  SBC: 7, // 1i1 subtract borrow carry

  // unary ternary functions (a.3.5) https://www.scribd.com/doc/78370674/Ternary-Computing-Testbed-3-Trit-Computer-Architecture
  NTI: 8, // 10i negative ternary inverter (tritwise i01 -> 1ii)
  STI: 9, // 100 simple ternary inverter   (tritwise i01 -> 10i)
  PTI:10, // 101 positive ternary inverter (tritwise i01 -> 11i)
  FD: 11, // 11i forward diode             (tritwise i01 -> 001)
  RD: 12, // 110 reverse diode             (tritwise i01 -> i00)

  CPY:13  // 111 compare Y
};

const ADDR_MODE = {
  ABSOLUTE: -1,
  ACCUMULATOR: 0,
  IMMEDIATE: 1,

  // internal modes only used by assembler, not instruction coding format
  BRANCH_RELATIVE: 2,
};

const FLAGS = {
  // flag (aa) 9 trits
  L: -4, // -4 ii L least significant trit of A (if 0, divisible by 3)
  I: -3, // -3 i0 I interrupts masked
  C: -2, // -2 i1 C carry
  D: -1, // -1 0i D dead zero
  S:  0, //  0 00 S sign, set to first nonzero trit of A (i=negative, 1=positive, or 0 if 0)
  V:  1, // +1 01 V overflow/underflow
  U:  2, // +2 1i U unused for now
  H:  3, // +3 10 H halt code
  R:  4, // +4 11 R running, 1 when executing forward, i backwards, 0 halted
};

const INSTRUCTION_ALIASES = {
  NEG: 'STI', // negate = simple ternary inverter
  NOT: 'STI', // not = simple ternary inverter

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
  BRA: 'BRRNZ', // branch always = branch if running is not zero
};

const XOP = {

  TAX: 1,       // 0001 transfer accumulator to index
  TAY: 2,       // 001i transfer accumulator to yindex
  TXA: 3,       // 0010 transfer index to accumulator
  TYA: 4,       // 0011 transfer yindex to accumulator

  INX: 5,       // 01ii increment index
  INY: 6,       // 01i0 increment yindex
  DEX: 7,       // 01i1 decrement index
  DEY: 8,       // 010i decrement yindex

  CLC: 9,       // 0100 clear carry flag
  CLI: 10,      // 0101 clear interrupt-disable flag
  CLV: 11,      // 011i clear overflow flag
  SECP: 12,     // 0110 set carry flag positive
  SECN: 13,     // 0111 set carry flag negative
  SEIP: 14,     // 1iii set interrupt flag positive
  SEIN: 15,     // 1ii0 set interrupt flag negative

  INTN: 16,     // 1ii1 interrupt negative
  INTZ: 17,     // 1i0i interrupt zero
  INTP: 18,     // 1i00 interrupt positive

  BRK: 19,      // 1i01 breakpoint

  LDAXY: 20,    // 1i1i load into accumulator absolute from Y<<5 + X
  STAXY: 21,    // 1i10 store accumulator absolut to Y<<5 + X

  CLD: 22,      // 1i11 clear data flag
  SEDP: 23,     // 10ii set data flag positive
  SEDN: 24,     // 10i0 set data flag negative

  HALTP: -38,   // iii1 halt positive
  HALTZ: -39,   // iii0 halt zero
  HALTN: -40,   // iiii halt negative
};

module.exports = {
  OP,
  ADDR_MODE,
  FLAGS,
  INSTRUCTION_ALIASES,
  XOP
};
