'use strict';

// Array of 5-trit tryte memory cells backed by an Int8Array
class Memory {
  constructor(opts={}) {
    this.tryteCount = opts.tryteCount;
    if (this.tryteCount === undefined) throw new Error('memory reqires tryteCount option');

    // Addresses are balanced ± TODO
    if (!Number.isInteger((this.tryteCount - 1) / 2)) throw new Error('memory (tryteCount-1)/2 must be integral: '+tryteCount);
    this.maxAddress = (this.tryteCount - 1) / 2;
    this.midAddress = 0;
    this.minAddress = -this.maxAddress;

    this.bal2unbal = this.maxAddress;

    this.arrayType = Int8Array; // Int8Array is 8-bit signed -129 to +128, fits 5-trit -121 to +121
    this._array = opts._array || new this.arrayType(new ArrayBuffer(this.tryteCount));
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

  readNoTrap(address) {
    if (address < this.minAddress || address > this.maxAddress) throw new Error('out-of-range read: '+address);
    //console.log('READ',address,address+this.bal2unbal,this._array[address+this.bal2unbal]);
    return this._array[address + this.bal2unbal];
  }

  writeNoTrap(address, value) {
    if (address < this.minAddress || address > this.maxAddress) throw new Error('out-of-range write: '+address+','+value);
    //console.log('WRITE',address,value,address+this.bal2unbal);
    return (this._array[address + this.bal2unbal] = value);
    //if (this._array[address + this.bal2unbal] !== value) {
    //  console.log('FAILED TO WRITE',this._array[address + this.bal2unbal],value,this._array.length);
    //}
  }

  // Read one tryte
  read(address) {
    const traps = this.getTraps(address);
    if (traps.read) {
      const value = traps.read(address);
      if (value !== undefined) {
        this.writeNoTrap(address, value);
      }
    }

    return this.readNoTrap(address);
  }

  // Write one tryte
  write(address, value) {
    this.writeNoTrap(address, value);

    const traps = this.getTraps(address);
    if (traps.write) {
      traps.write(address, this.readNoTrap(address));
    }

    return this.readNoTrap(address);
  }

  // Write an _array of trytes
  writeArray(address, data) {
    let i = address;
    for(let tryte of data) {
      this.write(i++, tryte);
    }
  } 

  // Get a subarray view of memory starting at address, to end
  subarray(address, end) {
    if (end !== undefined) end += this.bal2unbal;
    return this._array.subarray(address + this.bal2unbal, end);
  }

  // TODO: write individual trits, tritmapped-canvas
}

module.exports = function(opts) {
  return new Memory(opts);
};
