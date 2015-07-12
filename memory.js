'use strict';

// Array of 5-trit tryte memory cells backed by an Int8Array
class Memory {
  constructor(opts={}) {
    this.tryteCount = opts.tryteCount;
    if (this.tryteCount === undefined) throw new Error('memory reqires tryteCount option');
    this.array = opts.array || new Int8Array(new ArrayBuffer(this.tryteCount));
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
