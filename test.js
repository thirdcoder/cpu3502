'use strict';

const test = require('tape');
const CPU = require('./3502');
const Memory = require('./memory');
const assembler = require('./as');
const {decode_instruction, disasm1, disasm} = require('./instr_decode');
const {OP, ADDR_MODE, FLAGS, BRANCH_INSTRUCTION_ALIASES, XOP} = require('./opcodes');
const {add, inc, dec} = require('./arithmetic');

test('halts', (t) => {
  const cpu = CPU();

  cpu.memory.write(0, -118); // iii0i HALT_Z
  cpu.run();
  t.end();
});

test('branch instruction decoding', (t) => {

  const machine_code = assembler(['BRSNZ +121']);

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
      'BRSNZ -1', //'BNE -1',
      'BRSEZ +2', //BEQ +2
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
  const machine_code = assembler([
    'NOP A',
    'NOP A',
    'foo1:',
    'BNE foo1'
    ]);

  t.equal(machine_code[0], 0);  // 0: NOP A
  t.equal(machine_code[1], 0);  // 0: NOP A
  t.equal(machine_code[2], 10); // 1: BNE
  t.equal(machine_code[3], 2);  // 2: label

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
      'BNE -1',
      'BEQ +2',
      'HALT_N',
      'HALT_P',
      'LDA #42',
      'STA 0',

      'LDA #%00i01',
      'PTI A',

      'TAX',

      'HALT_Z'];


      /*

        this.memory[x++] = bts2n('10i10'); // operation 10i, addressing mode 1
        this.memory[x++] = bts2n('11001'); // flag 11, trit 0, compare 0
        this.memory[x++] = bts2n('00000'); // nop a

        this.memory[x++] = bts2n('00010'); // nop #-121
        this.memory[x++] = bts2n('iiiii'); // #

        this.memory[x++] = bts2n('000i0'); // nop 29524
        this.memory[x++] = bts2n('11111'); // xx
        this.memory[x++] = bts2n('11111'); // xx

        this.memory[x++] = bts2n('00011'); // bne, not taken
        this.memory[x++] = bts2n('0000i'); //  relative branch destination, -1

        this.memory[x++] = bts2n('00001'); // beq (br s=0,branch if sign trit flag is zero, accumulator is zero)
        this.memory[x++] = bts2n('0001i'); //  relative branch destination, +2

        this.memory[x++] = bts2n('iiiii'); // iiiii halt i, skipped by above branch
        this.memory[x++] = bts2n('iii1i'); // iiiii halt 1, also skipped by same branch

        this.memory[x++] = bts2n('1ii10'); // lda #
        this.memory[x++] = bts2n('1iii0'); // #42

        this.memory[x++] = bts2n('011i0'); // sta 0
        this.memory[x++] = bts2n('00000'); // xx
        this.memory[x++] = bts2n('00000'); // xx

        this.memory[x++] = bts2n('iii0i'); // iiiii halt 0
    */

  const machine_code = assembler(lines);
  cpu.memory.writeArray(0, machine_code);
  cpu.run();

  //TODO: tests t.equal(cpu.accum, 42);

  t.end();
});


