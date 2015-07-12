'use strict';

const {TRITS_PER_TRYTE, TRYTES_PER_WORD, TRITS_PER_WORD, MAX_TRYTE, MIN_TRYTE, MEMORY_SIZE} = require('./arch');

class Memory {
  constructor(opts={}) {
    this.array = new Int8Array(new ArrayBuffer(MEMORY_SIZE));
    this.map = opts.map || {};
  }

  // Read one tryte
  read(address) {
    // TODO: trap reads
    return this.array[address];
  }

  // Write one trytr
  write(address, value) {
    this.array[address] = value;
    // TODO: trap writes
  }

  // Write an array of trytes
  writeArray(address, data) {
    let i = address;
    for(let tryte of data) {
      this.array[i++] = tryte;
    }
  } 

  // TODO: write individual trits, tritmapped-canvas
}

module.exports = function(opts) {
  return new Memory(opts);
};
