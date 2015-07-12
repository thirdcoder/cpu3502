'use strict';

const test = require('tape');
const CPU = require('./3502');
const assembler = require('./as');

test('halts', (t) => {
  const cpu = CPU();

  cpu.memory[0] = -118; // iii0i HALT_Z
  cpu.run();
  t.end();
});

test('assembly', (t) => {
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

  let machine_code = assembler(lines);
  cpu.writeTrytes(0, machine_code);
  cpu.run();

  //TODO: tests t.equal(cpu.accum, 42);

  t.end();
});


