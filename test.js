'use strict';

const test = require('tape');
const CPU = require('./3502');
const Memory = require('./memory');
const assembler = require('./as');
const {decode_instruction, disasm1, disasm} = require('./instr_decode');
const {OP, ADDR_MODE, FLAGS, XOP} = require('./opcodes');
const {add, inc, dec} = require('./arithmetic');

test('halts', (t) => {
  const cpu = CPU();

  cpu.memory.write(0, -118); // iii0i HALT_Z
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
      'NOP A',
      'NOP #%iiiii', // -121',
      'NOP 29524',
      'BRSNZ #-1', //'BNE -1',
      'BRSEZ #+2', //BEQ +2
      'HALT_N',
      'HALT_P',
      'LDA #%1iii0', // #42
      'STA 0',
      'PTI A',
      'TAX',
      'HALT_Z'];

  const machine_code = assembler(lines); 

  const dis = disasm(machine_code);

  console.log(dis);

  for (let i = 0; i < lines.length; ++i) {
    const before = lines[i];
    const after = dis[i];

    t.equal(before, after);
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
    'NOP A',
    'NOP A',
    'foo1:',
    'BNE foo1'
    ]);

  t.equal(machine_code[0], 0);  // 0: NOP A
  t.equal(machine_code[1], 0);  // 0: NOP A
  t.equal(machine_code[2], 10); // 1: BNE
  t.equal(machine_code[3], -2); // 2: relative label

  // forward reference
  machine_code = assembler([
    'BNE foo2',
    'foo2:',
  ]);
  console.log(machine_code);
  t.equal(machine_code[0], 10); // BNE
  t.equal(machine_code[1], 2);  // +2 relative address, after 2-byte instruction

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
  var lines = [
      'LDA #$ijk',
      'LDA #%ii1i0',
      'LDA #&QF',
      'NOP A',
      'NOP #-121',
      'NOP 29524',
      'LDA #0',
      'BNE #-1',  // not taken
      'BEQ #+2',  // taken
      'HALT_N',   // (skipped by above branch)
      'HALT_P',   // (also skipped)
      'LDA #42',
      'STA 0',    // [0] = 42

      'LDA #%00i01',
      'PTI A',

      'TAX',      // X = A
      'INX',
      'DEX',
      'DEX',

      'HALT_Z'];

  const machine_code = assembler(lines);
  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  t.equal(cpu.memory.read(0), 42);

  t.equal(cpu.accum, 119);
  t.equal(cpu.index, 118);
  t.equal(cpu.yindex, 0);
  t.equal(cpu.pc, machine_code.length - 1);

  t.equal(cpu.get_flag(FLAGS.R), 0);
  t.equal(cpu.get_flag(FLAGS.H), 0);

  t.end();
});

test('adc overflow flag', (t) => {
  const cpu = CPU();
  var lines = [
    'LDA #121',
    'SECN',
    'ADC #121',
    'HALT_Z'
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
  t.equal(cpu.get_flag(FLAGS.V), 1);

  t.end();
});

test('clear overflow flag', (t) => {
  const cpu = CPU();
  var lines = [
    'LDA #121',
    'ADC #121', // V = 1
    'CLV',      // V = 0
    'SECN',     // C = -1
    'HALT_Z'
  ];

  const machine_code = assembler(lines);
  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  t.equal(cpu.get_flag(FLAGS.V), 0);
  t.equal(cpu.get_flag(FLAGS.C), -1);

  t.end();
});
