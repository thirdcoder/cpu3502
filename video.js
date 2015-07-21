'use strict';

const {TRITS_PER_TRYTE, T_TO_TRITS_PER_TRYTE, TRYTES_PER_WORD, MAX_ADDRESS, MIN_ADDRESS} = require('./arch');
const Triterm = require('tritmapped-terminal');
const raf = require('raf');

// 4 trits in each dimension, xxxx and yyyy
const VIDEO_TRYTE_COUNT = 4;

// '00xxx xyyyy' address -> 'xxxxx' tritmap value
const T_TO_VIDEO_TRYTE_COUNT = Math.pow(3,VIDEO_TRYTE_COUNT);
const VIDEO_ADDRESS_SIZE = Math.pow((T_TO_VIDEO_TRYTE_COUNT * TRITS_PER_TRYTE), TRYTES_PER_WORD) / TRITS_PER_TRYTE;

const VIDEO_ADDRESS_OFFSET = MAX_ADDRESS - VIDEO_ADDRESS_SIZE; // -3281
if (VIDEO_ADDRESS_SIZE + VIDEO_ADDRESS_OFFSET !== MAX_ADDRESS) throw new Error('wrong video address size');

const CHARGEN_ADDRESS = -3282; // 0i111 11110
const CURSOR_ROW_ADDRESS = -3283;
const CURSOR_COL_ADDRESS = -3284;

const INT_INPUT = -1;

function installVideoHardware(cpu) {
  const term = Triterm({
    addressTryteSize: VIDEO_TRYTE_COUNT,
    tritmap: cpu.memory.subarray(VIDEO_ADDRESS_OFFSET, VIDEO_ADDRESS_SIZE + VIDEO_ADDRESS_OFFSET),
    handleInput: (tt, ev) => {
      if (Number.isInteger(tt)) {
        cpu.interrupt(INT_INPUT, tt);
      }
    },
  });

  cpu.memory.addMemoryMap('video', {
    start: VIDEO_ADDRESS_OFFSET,                      // -3281      0i111 11111
    end: VIDEO_ADDRESS_SIZE + VIDEO_ADDRESS_OFFSET,   // 29524, end 11111 11111
    write: (address, value) => {
      // When writing to video, refresh the terminal canvas
      // TODO: optimize to throttle refresh? refresh rate 60 Hz?/requestAnimationFrame? dirty, only if changes?
      //console.log('video write:',address,value);
      term.tc.refresh();
    },
  });

  cpu.memory.addMemoryMap('chargen', {
    start: CHARGEN_ADDRESS,
    end: CHARGEN_ADDRESS,
    write: (address, value) => {
      console.log('chargen',value);

      let row = cpu.memory.read(CURSOR_ROW_ADDRESS);
      let col = cpu.memory.read(CURSOR_COL_ADDRESS);

      // wrap-around if row/col out of terminal range
      row %= term.rowCount; if (row < 0) row += term.rowCount;
      col %= term.colCount; if (col < 0) col += term.colCount;

      console.log('COLROW',col,row);

      term.setTTChar(value, col, row);
    },
  });

  raf(function tick() {
    term.refresh();
    raf(tick);
  });
}

module.exports = installVideoHardware;
