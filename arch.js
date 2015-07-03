'use strict';

// architectural defines: tryte (~byte) size, word size, memory size

const TRITS_PER_TRYTE = 5;
const TRYTES_PER_WORD = 2;
const TRITS_PER_WORD = TRITS_PER_TRYTE*TRYTES_PER_WORD;
const MAX_TRYTE = +(3**TRITS_PER_TRYTE-1)/2;
const MIN_TRYTE = -(3**TRITS_PER_TRYTE-1)/2;

const MEMORY_SIZE = 3**(TRITS_PER_WORD);

module.exports = {
  TRITS_PER_TRYTE,
  TRYTES_PER_WORD,
  TRITS_PER_WORD,
  MAX_TRYTE,
  MIN_TRYTE,
  MEMORY_SIZE
};
