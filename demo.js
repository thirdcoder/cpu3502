'use strict';

const CPU = require('./3502');

const installVideoHardware = require('./video.js');
const installAudioHardware = require('./audio.js');
const installTimerHardware = require('./timer.js');

const cpu = CPU();

installVideoHardware(cpu);
installAudioHardware(cpu);
installTimerHardware(cpu);

global.cpu = cpu;

const fs = require('fs');
let lines = fs.readFileSync('os.asm', 'utf8').split('\n');

cpu.assemble_bootcode(lines);
cpu.boot();
