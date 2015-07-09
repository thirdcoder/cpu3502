'use strict';

const {bts2n, n2bts} = require('balanced-ternary');

//  ii -4   01 +1
//  i0 -3   1i +2
//  i1 -2   10 +3
//  0i -1   11 +4
//  00  0
var NONARY_TO_BTS = {
  m:'ii', '④':'ii', // U+2463 circled digit four
  k:'i0', '③':'i0', // U+2462 circled digit three
  j:'i1', '②':'i1', // U+2461 circled digit two
  i:'0i', '①':'0i', // U+2460 circled digit one
  0:'00',
  1:'01',
  2:'1i',
  3:'10',
  4:'11',
};

function nonary2bts(ns, sep='') {
  var bt = '';
  for (var i = 0; i < ns.length; ++i) {
    var c = ns.charAt(i);

    var bt_c = NONARY_TO_BTS[c];
    if (!bt_c) throw new Error('nonary2bts('+ns+'): invalid nonary digit: '+c);

    bt += bt_c;
    if (i !== ns.length - 1 ) bt += sep;
  }

  return bt;
}

//console.log(nonary2bts('④③②①jkm01234', '_'));

module.exports = {
  nonary2bts: nonary2bts,
};

