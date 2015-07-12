'use strict';

// Array of 5-trit tryte memory cells backed by an Int8Array
class Memory {
  constructor(opts={}) {
    this.tryteCount = opts.tryteCount;
    if (this.tryteCount === undefined) throw new Error('memory reqires tryteCount option');
    this.array = opts.array || new Int8Array(new ArrayBuffer(this.tryteCount)); // Int8Array is 8-bit signed -129 to +128, fits 5-trit -121 to +121
    this.map = opts.map || {};
  }

  getTraps(address) {
    for (let name of Object.keys(this.map)) { // TODO: switch map to ES6 Map
      let info = this.map[name];

      if (address >= info.start && address <= info.end) {
        return {read:info.read, write:info.write};
      }
    }
    return {};
  }

  // Read one tryte
  read(address) {
    const traps = this.getTraps(address);
    if (traps.read) {
      const value = traps.read(address);
      if (value !== undefined) {
        this.array[address] = value;
      }
    }

    return this.array[address];
  }

  // Write one trytr
  write(address, value) {
    this.array[address] = value;

    const traps = this.getTraps(address);
    if (traps.write) {
      traps.write(address, this.array[address]);
    }
  }

  // Write an array of trytes
  writeArray(address, data) {
    let i = address;
    for(let tryte of data) {
      this.write(i++, tryte);
    }
  } 

  // TODO: write individual trits, tritmapped-canvas
}

module.exports = function(opts) {
  return new Memory(opts);
};
