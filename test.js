'use strict';

const test = require('tape');
const CPU = require('./3502');
const Memory = require('./memory');
const Stack = require('./stack');
const assembler = require('./as');
const {decode_instruction, disasm1, disasm} = require('./instr_decode');
const {OP, ADDR_MODE, FLAGS, XOP} = require('./opcodes');
const {add, inc, dec} = require('./arithmetic');

test('halts', (t) => {
  const cpu = CPU();

  cpu.memory.write(0, -118); // iii0i HALTZ
  cpu.run();
  t.end();
});

test('branch instruction decoding', (t) => {

  const machine_code = assembler(['BRSNZ #+121']);

  const di = decode_instruction(machine_code[0]);

  console.log(di);
  t.equal(di.flag, FLAGS.S);  // sign (S)
  t.equal(di.direction, 1);   // not equal (N)
  t.equal(di.compare, 0);     // zero (Z)
  t.end();
});

test('memory read/write', (t) => {
  const memory = Memory({tryteCount:9});

  t.equal(memory.read(0), 0); // 0 initialized

  memory.write(0, 42);
  t.equal(memory.read(0), 42);

  /* TODO
  t.equal(memory.read(-1), 0);
  memory.write(-1, 33);
  t.equal(memory.read(-1), 33);
  */

  t.end();
});

test('memory maps', (t) => {

  let trappedRead;
  let trappedWrite, trappedWriteValue;

  const memory = Memory({
    tryteCount:9, // ±4
    map: {
      trap1: {
        start: 3,
        end: 4,
        read: (address) => {
          console.log('trap1 read',address);
          trappedRead = address;
          return 42;
        },
        write: (address, value) => {
          console.log('trap1 write',address,value);
          trappedWrite = address;
          trappedWriteValue = value;
        },
      }
    }
  });

  t.equal(memory.read(0), 0);
  memory.write(0, 1);
  t.equal(memory.read(0), 1);
  t.equal(trappedRead === undefined, true);
  t.equal(trappedWrite === undefined, true);
  t.equal(trappedWriteValue === undefined, true);

  t.equal(memory.read(3), 42);
  t.equal(trappedRead, 3);
  t.equal(trappedWrite === undefined, true);
  t.equal(trappedWriteValue === undefined, true);

  t.equal(memory.read(4), 42);
  t.equal(trappedRead, 4);
  t.equal(trappedWrite === undefined, true);
  t.equal(trappedWriteValue === undefined, true);

  memory.write(4, 33);
  t.equal(trappedWrite, 4);
  t.equal(trappedWriteValue, 33);

  t.end();
});

test('arithmetic', (t) => {
  t.deepEqual(add(1, 2), {result:3, overflow:0});
  t.deepEqual(add(1, -2), {result:-1, overflow:0});
  t.deepEqual(add(1, -1), {result:0, overflow:0});

  //   11111
  // +     1
  // -------
  //  1iiiii
  // / ^^^^^
  //v   result
  t.deepEqual(add(121, 1), {result:-121, overflow:1}); // overflow wraps around

  t.deepEqual(add(121, 2), {result:-120, overflow:1});
  t.deepEqual(add(121, 121), {result:-1, overflow:1});


  t.deepEqual(add(0, 0), {result:0, overflow:0});
  t.deepEqual(add(0, -1), {result:-1, overflow:0});
  t.deepEqual(add(-1, -2), {result:-3, overflow:0});

  t.deepEqual(add(-121, -1), {result:121, overflow:-1}); // underflow
  t.deepEqual(add(-121, -121), {result:1, overflow:-1});

  t.deepEqual(add(-121, -121, 0), {result:1, overflow:-1});
  t.deepEqual(add(-121, -121, 1), {result:2, overflow:-1});
  t.deepEqual(add(-121, -121, -1), {result:0, overflow:-1});
  t.deepEqual(add(-121, 0, -1), {result:121, overflow:-1});

  t.end();
});

test('assemble/disassemble roundtrip', (t) => {
  // test assembly -> machine code -> assembly
  // note some instructions can be written multiple ways;
  // only test canonical forms
  let lines = [
      'LDA #%ii1i0',
      'DNOP A',
      'DNOP #%iiiii', // -121',
      'DNOP 29524',
      'BRSNZ #-1', //'BNE -1',
      'BRSEZ #+2', //BEQ +2
      'HALTN',
      'HALTP',
      'LDA #%1iii0', // #42
      'STA 0',
      'PTI A',
      'TAX',
      'LDA (29282),Y',
      'LDA 29282,X',
      'LDA 29282,Y',
      'HALTZ'];

  const machine_code = assembler(lines); 

  const dis = disasm(machine_code);

  console.log(dis);

  for (let i = 0; i < lines.length; ++i) {
    const before = lines[i];
    const after = dis[i];

    t.equal(after, before);
  }
  t.end();
});

test('assembler directive .equ absolute', (t) => {
  const machine_code = assembler([
    '.equ -29524 foo',
    'STA foo',
    ]);

  t.equal(machine_code[0], 33);   // STA absolute
  t.equal(machine_code[1], -121); // absolute address
  t.equal(machine_code[2], -121); // absolute address

  t.end();
});

test('assembler directive .equ immediate', (t) => {
  const machine_code = assembler([
    '.equ -100 foo',
    'STA #foo'
    ]);

  t.equal(machine_code[0], 39);   // STA immediate
  t.equal(machine_code[1], -100); // immediate value

  t.end();
});

test('assembly labels', (t) => {
  let machine_code = assembler([
    'foo1:',
    'BNE foo1'
    ]);
  t.equal(machine_code[0], 10); // BNE
  t.equal(machine_code[1], -2); // relative address

  // immediate, relative address
  machine_code = assembler([
    'BNE #-1'
    ]);
  t.equal(machine_code[0], 10); // BNE
  t.equal(machine_code[1], -1);

  machine_code = assembler([
    'BNE #1'
    ]);
  t.equal(machine_code[0], 10); // BNE
  t.equal(machine_code[1], 1);


  // absolute
  machine_code = assembler([
    'BNE 0'
    ]);
  t.equal(machine_code[0], 10); // BNE
  t.equal(machine_code[1], -2); // 2(end of this instruction) - -2(relative offset) = 0(absolute jump destination)


  machine_code = assembler([
    'NOP',
    'NOP',
    'foo1:',
    'BNE foo1'
    ]);

  //t.equal(machine_code[0], 0);  // 0: NOP
  //t.equal(machine_code[1], 0);  // 0: NOP
  t.equal(machine_code[2], 10); // 1: BNE
  t.equal(machine_code[3], -2); // 2: relative label

  // forward reference
  machine_code = assembler([
    'BNE foo2',
    'foo2:',
  ]);
  console.log(machine_code);
  t.equal(machine_code[0], 10); // BNE
  t.equal(machine_code[1], 0);  // +0 relative address, after 2-byte instruction

  t.end();
});

test('assembly branch out-of-range', (t) => {
  t.doesNotThrow(() => {
    let machine_code = assembler(['BNE 123']); // from 2 to 123 absolute, maximum range 121
    t.equal(machine_code[1], 121);

    machine_code = assembler(['BNE -119']); // from 2 to -119, minimum range -121
    t.equal(machine_code[1], -121);
  });

  t.throws(() => {
    const machine_code = assembler(['BNE 124']); // from 2 to 123, a branch too far (122)
    console.log(machine_code);
  });

  t.throws(() => {
    const machine_code = assembler(['BNE -120']); // from 2 to -120, a branch too far (-122)
    console.log(machine_code);
  });

  t.end();
});

test('execute', (t) => {
  const cpu = CPU();
  let lines = [
      'LDA #$ijk',
      'LDA #%ii1i0',
      'LDA #&QF',
      'NOP',
      'NOP',
      'NOP',
      'LDA #0',
      'BNE #-1',  // not taken
      'BEQ #+2',  // taken
      'HALTN',   // (skipped by above branch)
      'HALTP',   // (also skipped)
      'LDA #42',
      'STA 0',    // [0] = 42

      'LDA #%00i01',
      'PTI A',

      'TAX',      // X = A
      'INX',
      'DEX',
      'DEX',

      'HALTZ'];

  const machine_code = assembler(lines);
  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  t.equal(cpu.memory.read(0), 42);

  t.equal(cpu.accum, 119);
  t.equal(cpu.index, 118);
  t.equal(cpu.yindex, 0);
  t.equal(cpu.pc, machine_code.length - 1);

  t.equal(cpu.flags.R, 0);
  t.equal(cpu.flags.H, 0);

  t.end();
});

test('adc overflow flag', (t) => {
  const cpu = CPU();
  let lines = [
    'LDA #121',
    'SECN',
    'ADC #121',
    'HALTZ'
  ];

  const machine_code = assembler(lines);
  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  //  11111
  //  11111
  //      i
  // 1000i1
  // Vaccum
  t.equal(cpu.accum, -2);
  t.equal(cpu.flags.V, 1);

  t.end();
});

test('clear overflow flag', (t) => {
  const cpu = CPU();
  let lines = [
    'LDA #121',
    'ADC #121', // V = 1
    'CLV',      // V = 0
    'SECN',     // C = -1
    'HALTZ'
  ];

  const machine_code = assembler(lines);
  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  t.equal(cpu.flags.V, 0);
  t.equal(cpu.flags.C, -1);

  t.end();
});

test('assemble low/high addresses', (t) => {
  let lines = [];
  for (let i = 0; i < 121; ++i)
    lines.push('NOP');

  lines = lines.concat([
    'NOP',
    'end:',
    'LDA #end.low',
    'LDA #end.high',
  ]);

  const machine_code = assembler(lines);

  t.equal(machine_code[123], -121); // #end.low
  t.equal(machine_code[125], 1);    // #end.high

  t.end();
});

test('interrupts', (t) => {
  const cpu = CPU();
  let lines = [
    // these interrupts are disabled by default, no effect (masked by I=-1)
    'INTN',
    'INTP',

    // set interrupt handler for -1
    '.equ '+(cpu.memory.minAddress  )+' intN_L',
    '.equ '+(cpu.memory.minAddress+1)+' intN_H',
    'LDA #handle_intN.low',
    'STA intN_L',
    'LDA #handle_intN.high',
    'STA intN_H',

    // enable interrupts and execute int -1
    'CLI',
    'INTN',
    'HALTZ',

    // interrupt handler, change memory to detect executed for test
    'handle_intN:',
    'LDA #42',
    'STA 1000',
    'HALTZ',
  ];

  const machine_code = assembler(lines);
  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  t.equal(cpu.memory.read(1000), 42);

  t.end();
});

test('flags object', (t) => {
  const Flags = require('./flags');

  const flags = Flags();
  t.equal(flags.L, 0);

  flags.L = 1;
  t.equal(flags.L, 1);
  t.equal(flags.value, 1);

  flags.L = -1;
  t.equal(flags.L, -1);
  t.equal(flags.value, -1);

  flags.R = 1;
  t.equal(flags.R, 1);        // R.......L
  t.equal(flags.value, 6560); // 10000000i

  t.end();
});

test('assembler data', (t) => {
  const machine_code = assembler([
    '.data "123456789abc"'
  ]);

  t.deepEqual(machine_code, [1,2,3,4,5,6,7,8,9,42,43,44]);

  t.end();
});

test('load pointer LDAXY', (t) => {
  const cpu = CPU();
  let lines = [
    'LDY #%11111',  // upper address
    'LDX #%iiiii',  // lower address
    'LDAXY',
    'HALTZ',
  ];

  const machine_code = assembler(lines);
  cpu.memory.writeArray(0, machine_code);
  cpu.memory.write(29282, 33); // 11111iiiii
  cpu.run();
  
  t.equal(cpu.accum, 33);

  t.end();
});

test('store pointer STAXY', (t) => {
  const cpu = CPU();
  let lines = [
    'LDY #%11111',  // upper address
    'LDX #%iiiii',  // lower address
    'LDA #33',
    'STAXY',
    'HALTZ',
  ];

  const machine_code = assembler(lines);
  cpu.memory.writeArray(0, machine_code);
  cpu.run();
  
  t.equal(cpu.memory.read(29282), 33); // 11111iiiii

  t.end();
});


test('forward unresolved branch labels origin 0', (t) => {
  const machine_code = assembler([
    '.org 0',
    'BEQ done',
    'done:',
  ]);
  console.log(machine_code);
  t.equal(machine_code[0], 1);   // BEQ
  t.equal(machine_code[1], 0); // +0
  t.end();
});

test('forward unresolved branch labels origin 100', (t) => {
  const machine_code = assembler([
    '.org 100',
    'BEQ done',
    'done:',
  ]);
  console.log(machine_code);
  t.equal(machine_code[0], 1);   // BEQ
  t.equal(machine_code[1], 0); // +0
  t.end();
});

test('forward unresolved branch labels origin 1000', (t) => {
  const machine_code = assembler([
    '.org 1000',
    'BEQ done',
    'done:',
  ]);
  console.log(machine_code);
  t.equal(machine_code[0], 1);   // BEQ
  t.equal(machine_code[1], 0); // +0
  t.end();
});


test('trit shifts', (t) => {
  const cpu = CPU();
  let lines = [
    'LDA #%001i1',
    'SECN',       // C=i
    'SHR A',
    'BRDNP fail', // expect D=1, shifted out from lst
    'BRLNN fail', // and L=i, new lst
    'CMP #%i001i',// shifted in carry trit C=i to mst
    'BNE fail',

    'LDA #%00iii',
    'SEDP',       // D=1
    'SHL A',
    'BRCNZ fail', // expect C=0 shifted out from mst
    'CMP #%0iii1',// shifted in D from left
    'BNE fail',

    'LDA #%00iii',
    'CLD',        // shift in zero from left
    'SHL A',// Z
    'CMP #%0iii0',
    'BNE fail',

    'HALTZ',

    'fail:',
    'HALTN',
  ];

  const machine_code = assembler(lines);
  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  t.equal(cpu.flags.H, 0);

  t.end();
});

test('branch always, forward reference', (t) => {
  const cpu = CPU();
  let lines = [
    'BRA end',
    'HALTN',  // if halts here (H=i), didn't take branch

    'end:',
    'HALTZ',

    'NOP',  // nop sled
    'HALTP',  // if halts here (H=1), branched to wrong address
  ];

  const machine_code = assembler(lines);

  console.log(machine_code);
  t.equal(machine_code[0], 118); // BRA
  t.equal(machine_code[1], 1);   // +1 relative address (also tested 'forward unresolved branch labels')
  t.equal(machine_code[2], -121);// HALTN
  t.equal(machine_code[3], -118);// HALTZ
  //t.equal(machine_code[4], 0);   // NOP
  t.equal(machine_code[5], -115);// HALTP

  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  t.equal(cpu.flags.H, 0);

  t.end();
});

test('stack', (t) => {
  const cpu = CPU();
  let lines = [
    'LDY #0',
    'LDX #100',
    'TXYS',          // set stack pointer
    'LDA #33',
    'PHA',

    'INC A',
    'PLA',
    'STA -99',
    'HALTZ',
  ];

  const machine_code = assembler(lines);

  console.log(machine_code);

  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  t.equal(cpu.memory.read(100), 33);
  t.equal(cpu.memory.read(101), 0);
  t.equal(cpu.memory.read(-99), 33);

  t.end();

});

test('bad assembler instruction', (t) => {
  t.throws(() => {
    assembler(['foo']);
  });

  t.throws(() => {
    assembler(['PHP unexpectedoperand']);
  });

  t.end();
});

test('stack flags', (t) => {
  const cpu = CPU();
  let lines = [
    'LDY #0',
    'LDX #100',
    'TXYS',         // set stack pointer
    'PHP',          // push processor flags

    'PLA',
    'STA 111',
    'PLA',
    'STA 110',
    'HALTZ',
  ];

  const machine_code = assembler(lines);

  console.log(machine_code);

  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  t.equal(cpu.memory.readWord(110), 6640);

  t.end();

});

test('stack object', (t) => {
  const memory = Memory({tryteCount:9});
  const stack = Stack(memory);
  stack.stackptr = 0;

  stack.push(33);
  t.equal(memory.read(0), 33);

  stack.push(66);
  t.equal(memory.read(1), 66);

  t.equal(stack.pull(), 66);
  t.equal(stack.pull(), 33);

  t.equal(stack.stackptr, 0);


  stack.pushWord(9999);
  t.equal(stack.pullWord(), 9999);
  t.equal(stack.stackptr, 0);

  stack.pushWord(29282);
  console.log(memory._array);
  t.equal(stack.pull(), 121);
  t.equal(stack.pull(), -121);

  t.end();
});

test('assembler symbol redefinition', (t) => {
  t.throws(() => {
    assembler([
      '.equ 1 foo',
      '.equ 2 foo']);
  });

  t.end();
});

test('assembler addresing modes', (t) => {
  const a = new assembler.Assembler;

  t.equal(a.parse_operand('A').addressing_mode, ADDR_MODE.ACCUMULATOR);
  t.equal(a.parse_operand('#13').addressing_mode, ADDR_MODE.IMMEDIATE);
  t.equal(a.parse_operand('#13').operand_value, 13);
  t.equal(a.parse_operand('#%111').operand_value, 13);
  t.equal(a.parse_operand('21333').addressing_mode, ADDR_MODE.ABSOLUTE);
  t.equal(a.parse_operand('21333').operand_value, 21333);

  t.equal(a.parse_operand('21333,X').addressing_mode, ADDR_MODE.ABSOLUTE_X);
  t.equal(a.parse_operand('21333,X').operand_value, 21333);
  t.equal(a.parse_operand('21333,Y').addressing_mode, ADDR_MODE.ABSOLUTE_Y);
  t.equal(a.parse_operand('21333,Y').operand_value, 21333);

  t.equal(a.parse_operand('(21333)').addressing_mode, ADDR_MODE.INDIRECT);
  t.equal(a.parse_operand('(21333)').operand_value, 21333);
  t.equal(a.parse_operand('(21333,X)').addressing_mode, ADDR_MODE.INDEXED_X_INDIRECT);
  t.equal(a.parse_operand('(21333,X)').operand_value, 21333);
  t.equal(a.parse_operand('(21333),Y').addressing_mode, ADDR_MODE.INDIRECT_INDEXED_Y);
  t.equal(a.parse_operand('(21333),Y').operand_value, 21333);

  t.doesNotThrow(() => { assembler(['LDA #13']); });
  t.doesNotThrow(() => { assembler(['LDA 21333']); });

  // unsupported for now
  t.throws(() => { assembler(['LDX 21333,X']); });
  t.throws(() => { assembler(['LDX 21333,Y']); });
  t.throws(() => { assembler(['LDX (21333)']); });
  t.throws(() => { assembler(['LDX (21333,X)']); });
  t.throws(() => { assembler(['LDX (21333),Y']); });

  t.end();
});

test('jump instruction', (t) => {
  const cpu = CPU();
  let lines = [
    'JMP over',
    'HALTN',

    'over:',
    'HALTZ',
  ];

  const machine_code = assembler(lines);
  t.equal(machine_code[0], 101);  // JMP
  t.equal(machine_code[1], 4);    // absolute address
  t.equal(machine_code[2], 0);    // absolute address
  t.equal(machine_code[3], -121); // HALTN
  t.equal(machine_code[4], -118); // HALTZ

  console.log(machine_code);

  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  t.equal(cpu.flags.H, 0);

  t.end();
});

test('no-operation and debug nop', (t) => {
  const cpu = CPU();
  let lines = [
    'NOP',
    'LDA #33',
    'DNOP A',   // hits debugger or throws JavaScript exception
    'HALTN',
  ];

  const machine_code = assembler(lines);
  cpu.memory.writeArray(0, machine_code);
  t.throws(() => {
    cpu.run();
  });

  t.end();
});

test('jump to subroutine', (t) => {
  const cpu = CPU();
  let lines = [
    'NOP',
    'NOP',
    'NOP',

    'JSR subroutine',
    'DEC -99',        // subtract to 33 - 1 = 32, verify returned
    'HALTZ',

    'subroutine:',
    'LDA #33',
    'STA -99',
    'RTS',

    'HALTN',
  ];

  const machine_code = assembler(lines);
  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  t.equal(cpu.flags.H, 0);
  t.equal(cpu.memory.read(-99), 32);

  t.end();
});

test('subroutine multiple returns', (t) => {
  const cpu = CPU();
  let lines = [
    'LDA #10',
    'STA -90',
    'JSR sub2',
    'STA -91',
    'JSR sub2',
    'STA -92',
    'JSR sub2',
    'STA -93',
    'JSR sub2',
    'STA -94',
    'JSR sub2',
    'STA -95',
    'JSR sub2',
    'STA -96',

    'HALTZ',

    // subtract two from accumulator
    'sub2:',
    'DEC A',
    'DEC A',
    'RTS',

    'HALTN',
  ];

  const machine_code = assembler(lines);
  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  t.equal(cpu.flags.H, 0);
  t.equal(cpu.memory.read(-90), 10);
  t.equal(cpu.memory.read(-91), 10 - 2);
  t.equal(cpu.memory.read(-92), 10 - 2 - 2);
  t.equal(cpu.memory.read(-93), 10 - 2 - 2 - 2);
  t.equal(cpu.memory.read(-94), 10 - 2 - 2 - 2 - 2);
  t.equal(cpu.memory.read(-95), 10 - 2 - 2 - 2 - 2 - 2);
  t.equal(cpu.memory.read(-96), 10 - 2 - 2 - 2 - 2 - 2 - 2);

  t.end();

});

test('word assembler directive', (t) => {
  let lines = [
    '.word -29282',
  ];

  const machine_code = assembler(lines);
  t.equal(machine_code.length, 2);
  t.equal(machine_code[0], 121);  // little endian
  t.equal(machine_code[1], -121);

  t.end();
});

test('word assembler directive label', (t) => {
  let lines = [
    'NOP',
    '.word foo',
    'foo:',
  ];

  const machine_code = assembler(lines);
  console.log(machine_code);
  t.equal(machine_code.length, 3);
  t.equal(machine_code[0], 56);   // NOP
  t.equal(machine_code[1], 3);    // .word foo
  t.equal(machine_code[2], 0);    // .word foo

  t.throws(() => {
    assembler(['.word 99999999']);
  });

  t.end();
});

test('tryte assembler directive', (t) => {
  let lines = [
    '.tryte 33',
    '.tryte 66',
  ];

  const machine_code = assembler(lines);
  t.equal(machine_code.length, 2);
  t.equal(machine_code[0], 33);
  t.equal(machine_code[1], 66);

  t.throws(() => { assembler(['.tryte 122']); });
  t.throws(() => { assembler(['.tryte -122']); });

  t.end();
});

test('assemble load indirect indexed', (t) => {
  let lines = [
    'LDA_IIY (29282),Y',
    'LDA (29282),Y',
  ];

  const machine_code = assembler(lines);
  t.equal(machine_code.length, 6);
  console.log(machine_code);
  t.equal(machine_code[0], 104);  // LDA_IIY
  t.equal(machine_code[1], -121);
  t.equal(machine_code[2], 121);

  t.equal(machine_code[3], 104);  // LDA_IIY
  t.equal(machine_code[4], -121);
  t.equal(machine_code[5], 121);

  t.end();
});

test('execute load indirect indexed', (t) => {
  const cpu = CPU();
  let lines = [
    'LDA (table_ptr),Y',
    'STA -1',

    'INY',
    'LDA (table_ptr),Y',
    'STA -2',

    'INY',
    'LDA (table_ptr),Y',
    'STA -3',

    'HALTZ',


    'table_ptr:',
    '.word table',

    'table:',
    '.tryte 33',
    '.tryte 66',
    '.tryte 99',
  ];

  const machine_code = assembler(lines);
  console.log(machine_code);
  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  t.equal(cpu.memory.read(-1), 33);
  t.equal(cpu.memory.read(-2), 66);
  t.equal(cpu.memory.read(-3), 99);

  t.end();
});

test('absolute indexed', (t) => {
  const cpu = CPU();
  let lines = [
    'LDY #0',
    'LDA table,Y',
    'STA -1',

    'INY',
    'LDA table,Y',
    'STA -2',

    'INY',
    'LDA table,Y',
    'STA -3',

    'LDX #2',
    'LDA table,X',
    'STA -4',

    'HALTZ',


    'table:',
    '.tryte 33',
    '.tryte 66',
    '.tryte 99',
  ];

  const machine_code = assembler(lines);
  console.log(machine_code);
  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  t.equal(cpu.memory.read(-1), 33);
  t.equal(cpu.memory.read(-2), 66);
  t.equal(cpu.memory.read(-3), 99);
  t.equal(cpu.memory.read(-4), 99);

  t.end();
});
