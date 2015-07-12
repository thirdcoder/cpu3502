'use strict';

const CPU = require('./3502');
const {TRITS_PER_TRYTE, TRYTES_PER_WORD, TRITS_PER_WORD, MAX_TRYTE, MIN_TRYTE, MEMORY_SIZE} = require('./arch');
const Triterm = require('tritmapped-terminal');

const VIDEO_TRYTE_ADDRESS_SIZE = 4; // 4 trits in each dimension, xxxx and yyyy
const Memory = require('./memory');

const memory = Memory({
  tryteCount: MEMORY_SIZE,
  map: {
    video: {
      start: 0, // TODO: start at higher address?
      end: (3**VIDEO_TRYTE_ADDRESS_SIZE * TRITS_PER_TRYTE)**TRYTES_PER_WORD / TRITS_PER_TRYTE, // '00xxx xyyyy' address -> 'xxxxx' tritmap value
    },
  }
});

const cpu = CPU({
  memory: memory
});
global.cpu = cpu;

const term = Triterm({
  addressTryteSize: VIDEO_TRYTE_ADDRESS_SIZE,
  tritmap: cpu.memory.array.subarray(cpu.memory.map.video.start, cpu.memory.map.video.end)
});

const assembler = require('./as');

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

    'HALT_Z'
  ];

cpu.memory.writeArray(0, assembler(lines));

term.tc.refresh();

cpu.run();

