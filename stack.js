'use strict';

const {high_tryte, low_tryte, trytes2word} = require('./word');

class Stack {
  constructor(memory) {
    this.memory = memory;
    this.stackptr = 0;
  }

  push(value) {
    this.memory.write(this.stackptr, value);
    ++this.stackptr;
    // TODO: check overflow
  }

  pull() {
    --this.stackptr;
    return this.memory.read(this.stackptr);
  }


  pushWord(word) {
    this.push(low_tryte(word));
    this.push(high_tryte(word));
  }

  pullWord() {
    const high = this.pull();
    const low = this.pull();

    return trytes2word(high, low);
  }
}

module.exports = (memory) => new Stack(memory);
