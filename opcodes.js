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
  DNOP: 0, // 000 debug no operation
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
  STI: 9, // 100 simple ternary inverter   (tritwise i01 -> 10i) TODO: rename to NOT or NEG? confusing overloaded 'ST'..store
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
  INDIRECT: 3,
  INDEXED_X_INDIRECT: 4,
  INDIRECT_INDEXED_Y: 5,
  ABSOLUTE_X: 6,
  ABSOLUTE_Y: 7,
};

const FLAGS = {
  // flag (aa) 9 trits
  L: -4, // -4 ii L least significant trit of last value (if 0, divisible by 3)
  I: -3, // -3 i0 I interrupts masked
  C: -2, // -2 i1 C carry trit
  D: -1, // -1 0i D data trit, shift in
  S:  0, //  0 00 S sign, set to first nonzero trit of last value (i=negative, 1=positive, or 0 if 0)
  V:  1, // +1 01 V overflow/underflow
  U:  2, // +2 1i U unused for now
  H:  3, // +3 10 H halt code
  R:  4, // +4 11 R running, 1 when executing forward, i backwards, 0 halted
};

const INSTRUCTION_ALIASES = {
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
  BCC: 'BRCEZ', // branch if carry clear = branch if carry equal zero
  BCS: 'BRCNZ', // branch if carry set = branch if carry not equal zero
};

// xop family of opcodes, note this also includes embedded addressing mode (_addrmode),
// but in the assembler the opcode instructions are in OP_ADDR_MODE_TO_XOP, not here (but the CPU uses these)
const XOP = {
  NOP: 0,       // 0000 no operation

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

  STZ_ABX: 19,  // 1i01 store zero absolute,X indexed

  PHX: 20,      // 1i1i push index
  PHY: 21,      // 1i10 push yindex

  CLD: 22,      // 1i11 clear data flag
  SEDP: 23,     // 10ii set data flag positive
  SEDN: 24,     // 10i0 set data flag negative

  PHA: 25,      // 10i1 push accumulator to stack
  PHP: 26,      // 100i push processor flags to stack
  PLA: 27,      // 1000 pull accumulator from stack
  PLP: 28,      // 1001 pull processor flags from stack
  RTI: 29,      // 101i return from interrupt
  RTS: 30,      // 1010 return from subroutine
  TSXY: 31,     // 1011 transfer stack pointer to index and yindex
  TXYS: 32,     // 11ii transfer index and yindex to stack pointer
  JSR_ABS: 33,  // 11i0 jump to subroutine
  JMP_ABS: 34,  // 11i1 jump absolute

  PLX: 35,      // 110i pull index
  PLY: 36,      // 1100 pull yindex

  STZ_ABY: 37,  // 1101 store zero absolute,Y indexed
  STZ_IIY: 38,  // 111i store zero (indirect),Y indexed
  STZ_ABS: 39,  // 1110 store zero, absolute

  JMP_INDIR: 40,// 1111 jump indirect

  HALTN: -40,   // iiii halt negative
  HALTZ: -39,   // iii0 halt zero
  HALTP: -38,   // iii1 halt positive

  LDA_IIY: -37, // ii0i load accumulator from (indirect),Y indexed
  LDA_ABX: -36, // ii00 load accumulator from absolute,X
  LDA_ABY: -35, // ii01 load accumulator from absolute,Y
  STA_IIY: -34, // ii1i store accumulator to (indirect),Y indexed
  STA_ABX: -33, // ii10 store accumulator to absolute,X
  STA_ABY: -32, // ii11 store accumulator to absolute,Y

  LDX_ABY: -31, // i0ii load index from absolute,Y
  LDY_ABX: -30, // i0i0 load yindex from absolute,X
  STX_ABY: -29, // i0i1 store index to absolute,Y
  STY_ABX: -28, // i00i store yindex to absolute,X

  CMP_IIY: -27, // i000 compare accumulator with (indirect),Y indexed
  CMP_ABX: -26, // i001 compare accumulator with absolute,X
  CMP_ABY: -25, // i01i compare accumulator with absolute,Y
};

// raw xop key to addressing mode, for cpu instruction decoder
// note: not all listed here directly supported by assembler; see OP_ADDR_MODE_TO_XOP instead
const XOP_TO_ADDR_MODE = {
  JMP_ABS: ADDR_MODE.ABSOLUTE,
  JMP_INDIR: ADDR_MODE.INDIRECT,
  JSR_ABS: ADDR_MODE.ABSOLUTE,
  STZ_ABX: ADDR_MODE.ABSOLUTE_X,
  STZ_ABY: ADDR_MODE.ABSOLUTE_Y,
  STZ_IIY: ADDR_MODE.INDIRECT_INDEXED_Y,
  STZ_ABS: ADDR_MODE.ABSOLUTE,
  LDA_IIY: ADDR_MODE.INDIRECT_INDEXED_Y,
  LDA_ABX: ADDR_MODE.ABSOLUTE_X,
  LDA_ABY: ADDR_MODE.ABSOLUTE_Y,
  STA_IIY: ADDR_MODE.INDIRECT_INDEXED_Y,
  STA_ABX: ADDR_MODE.ABSOLUTE_X,
  STA_ABY: ADDR_MODE.ABSOLUTE_Y,
  LDX_ABY: ADDR_MODE.ABSOLUTE_Y,
  LDY_ABX: ADDR_MODE.ABSOLUTE_X,
  STX_ABY: ADDR_MODE.ABSOLUTE_Y,
  STY_ABX: ADDR_MODE.ABSOLUTE_X,
  CMP_IIY: ADDR_MODE.INDIRECT_INDEXED_Y,
  CMP_ABX: ADDR_MODE.ABSOLUTE_X,
  CMP_ABY: ADDR_MODE.ABSOLUTE_Y,
};

// most XOPs do not have operands, but some do (vs alu OP, which always does), irregular, listed here
// assembler opcode, addressing mode -> xop
// must be listed here if xop is supported by assembler and has non-implied addressing mode
const OP_ADDR_MODE_TO_XOP = {
  JMP: {
    [ADDR_MODE.ABSOLUTE]: XOP.JMP_ABS,
    [ADDR_MODE.INDIRECT]: XOP.JMP_INDIR,
  },
  JSR: {
    [ADDR_MODE.ABSOLUTE]: XOP.JSR_ABS,
  },
  STZ: {
    [ADDR_MODE.ABSOLUTE_X]: XOP.STZ_ABX,
    [ADDR_MODE.ABSOLUTE_Y]: XOP.STZ_ABY,
    [ADDR_MODE.INDIRECT_INDEXED_Y]: XOP.STZ_IIY,
    [ADDR_MODE.ABSOLUTE]: XOP.STZ_ABS,
  },


  LDA: {
    [ADDR_MODE.INDIRECT_INDEXED_Y]: XOP.LDA_IIY,
    [ADDR_MODE.ABSOLUTE_X]: XOP.LDA_ABX,
    [ADDR_MODE.ABSOLUTE_Y]: XOP.LDA_ABY,
  },
  STA: {
    [ADDR_MODE.INDIRECT_INDEXED_Y]: XOP.STA_IIY,
    [ADDR_MODE.ABSOLUTE_X]: XOP.STA_ABX,
    [ADDR_MODE.ABSOLUTE_Y]: XOP.STA_ABY,
  },
  LDX: {
    [ADDR_MODE.ABSOLUTE_Y]: XOP.LDX_ABY,
  },
  LDY: {
    [ADDR_MODE.ABSOLUTE_X]: XOP.LDY_ABX,
  },
  STX: {
    [ADDR_MODE.ABSOLUTE_Y]: XOP.STX_ABY,
  },
  STY: {
    [ADDR_MODE.ABSOLUTE_X]: XOP.STY_ABX,
  },
  CMP: {
    [ADDR_MODE.INDIRECT_INDEXED_Y]: XOP.CMP_IIY,
    [ADDR_MODE.ABSOLUTE_X]: XOP.CMP_ABX,
    [ADDR_MODE.ABSOLUTE_Y]: XOP.CMP_ABY,
  }
};

// xop -> alu operation
// if listed here, xop not implemented directly in xop.js but executed in alu.js
const XOP_TO_ALU_OP = {
  [XOP.LDA_IIY]: OP.LDA,
  [XOP.LDA_ABX]: OP.LDA,
  [XOP.LDA_ABY]: OP.LDA,
  [XOP.STA_IIY]: OP.STA,
  [XOP.STA_ABX]: OP.STA,
  [XOP.STA_ABY]: OP.STA,
  [XOP.LDX_ABY]: OP.LDX,
  [XOP.LDY_ABX]: OP.LDY,
  [XOP.STX_ABY]: OP.STX,
  [XOP.STY_ABX]: OP.STY,
  [XOP.CMP_IIY]: OP.CMP,
  [XOP.CMP_ABX]: OP.CMP,
  [XOP.CMP_ABY]: OP.CMP,
};

module.exports = {
  OP,
  ADDR_MODE,
  FLAGS,
  INSTRUCTION_ALIASES,
  XOP,
  XOP_TO_ADDR_MODE,
  OP_ADDR_MODE_TO_XOP,
  XOP_TO_ALU_OP,
};
