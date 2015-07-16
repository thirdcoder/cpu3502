'use strict';

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

  // TODO: push/pull words
}

module.exports = (memory) => new Stack(memory);
