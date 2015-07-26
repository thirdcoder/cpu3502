'use strict';

const {MAX_TRYTE, MIN_TRYTE} = require('./arch');

// Add two trytes with optional carry, returning result and overflow
function add(a, b, carryIn=0) {
  let result = a + b + carryIn;
  let fullResult = result;
  let carryOut = 0;

  // carryOut is 6th trit, truncate result to 5 trits
  if (result > MAX_TRYTE) {
    carryOut  = 1;
    result -= MAX_TRYTE * 2 + 1;
  } else if (result < MIN_TRYTE) {
    carryOut = -1; // underflow
    result += MAX_TRYTE * 2 + 1;
  }

  // overflow is set if sign is incorrect
  let overflow;
  if (Math.sign(fullResult) === Math.sign(result)) {
    overflow = 0;
  } else {
    overflow = Math.sign(fullResult) || Math.sign(result);
  }
  // note: for 5-trit + 5-trit + 1-trit will always V = C, but the logic above is generic
  if (overflow !== carryOut) throw new Error(`unexpected overflow calculation: ${overflow} !== ${carryOut}`);

  return {result, carryOut, fullResult, overflow};
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
