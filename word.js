'use strict';

const {slice_trits} = require('trit-getset');
const {TRITS_PER_TRYTE, T_TO_TRITS_PER_TRYTE, TRITS_PER_WORD} = require('./arch');

function low_tryte(n) {
  return slice_trits(n, 0, TRITS_PER_TRYTE);
}

function high_tryte(n) {
  return slice_trits(n, TRITS_PER_TRYTE, TRITS_PER_WORD);
}

function trytes2word(high, low) {
  return T_TO_TRITS_PER_TRYTE * high + low;
}

module.exports = {
  low_tryte,
  high_tryte,
  trytes2word,
};
