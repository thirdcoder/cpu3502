'use strict';

const {get_trit, set_trit} = require('trit-getset');
const {FLAGS} = require('./opcodes');

class Flags {
  constructor() {
    this.value = 0;
  }

  get_flag(flag) {
    let flag_index = flag + 4; // -4..4 to 0..8
    let flag_value = get_trit(this.value, flag_index);

    return flag_value;
  }

  set_flag(flag, value) {
    let flag_index = flag + 4; // -4..4 to 0..8

    this.value = set_trit(this.value, flag_index, value);
  }

  get L() { return this.get_flag(FLAGS.L); }
  get I() { return this.get_flag(FLAGS.I); }
  get C() { return this.get_flag(FLAGS.C); }
  get D() { return this.get_flag(FLAGS.D); }
  get S() { return this.get_flag(FLAGS.S); }
  get V() { return this.get_flag(FLAGS.V); }
  get R() { return this.get_flag(FLAGS.R); }
  get H() { return this.get_flag(FLAGS.H); }
  get F() { return this.get_flag(FLAGS.F); }

  set L(x) { this.set_flag(FLAGS.L, x); }
  set I(x) { this.set_flag(FLAGS.I, x); }
  set C(x) { this.set_flag(FLAGS.C, x); }
  set D(x) { this.set_flag(FLAGS.D, x); }
  set S(x) { this.set_flag(FLAGS.S, x); }
  set V(x) { this.set_flag(FLAGS.V, x); }
  set R(x) { this.set_flag(FLAGS.R, x); }
  set H(x) { this.set_flag(FLAGS.H, x); }
  set F(x) { this.set_flag(FLAGS.F, x); }
};

module.exports = (opts) => new Flags(opts);
