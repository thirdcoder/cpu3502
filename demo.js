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
      start: -3280,
      end: (3**VIDEO_TRYTE_ADDRESS_SIZE * TRITS_PER_TRYTE)**TRYTES_PER_WORD / TRITS_PER_TRYTE, // '00xxx xyyyy' address -> 'xxxxx' tritmap value
    },
      /* TODO
    input: {
      start: -3,
      end: -1,
    },
    */
  }
});

console.log('memory.map',memory.map);

const term = Triterm({
  addressTryteSize: VIDEO_TRYTE_ADDRESS_SIZE,
  tritmap: memory.subarray(memory.map.video.start, memory.map.video.end)
});

memory.map.video.write = (address, value) => {
  // When writing to video, refresh the terminal canvas
  // TODO: optimize to throttle refresh? refresh rate 60 Hz?/requestAnimationFrame? dirty, only if changes?
  //console.log('video write:',address,value);
  term.tc.refresh();
};


const cpu = CPU({
  memory: memory
});
global.cpu = cpu;

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

cpu.run();

