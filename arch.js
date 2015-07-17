'use strict';

// architectural defines: tryte (~byte) size, word size, memory size

const TRITS_PER_TRYTE = 5;
const T_TO_TRITS_PER_TRYTE = Math.pow(3, TRITS_PER_TRYTE);
const TRYTES_PER_WORD = 2;
const TRITS_PER_WORD = TRITS_PER_TRYTE*TRYTES_PER_WORD;
const MAX_TRYTE = +(T_TO_TRITS_PER_TRYTE-1)/2;
const MIN_TRYTE = -(T_TO_TRITS_PER_TRYTE-1)/2;

const T_TO_TRITS_PER_WORD = Math.pow(3, TRITS_PER_WORD);
const MEMORY_SIZE = T_TO_TRITS_PER_WORD;

module.exports = {
  TRITS_PER_TRYTE,
  T_TO_TRITS_PER_TRYTE,
  TRYTES_PER_WORD,
  TRITS_PER_WORD,
  T_TO_TRITS_PER_WORD,
  MAX_TRYTE,
  MIN_TRYTE,
  MEMORY_SIZE
};
