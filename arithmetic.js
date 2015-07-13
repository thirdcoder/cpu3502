'use strict';

const {MAX_TRYTE, MIN_TRYTE} = require('./arch');

// Add two trytes with optional carry, returning result and overflow
function add(a, b, carryIn=0) {
  let result = a + b + carryIn;
  let overflow = 0;
  
  if (result > MAX_TRYTE) {
    overflow = 1;
    result -= MAX_TRYTE * 2 + 1;
  } else if (result < MIN_TRYTE) {
    overflow = -1; // underflow
    result += MAX_TRYTE * 2 + 1;
  }

  return {result, overflow};
}

// Increment and decrement - no carry/overflow/underflow
// (similar to http://www.obelisk.demon.co.uk/6502/reference.html#INC - C, V not affected)
function inc(a) {
  return add(a, 1).result;
}

function dec(a) {
  return add(a, -1).result;
}

module.exports = {
  add,
  inc,
  dec,
};
