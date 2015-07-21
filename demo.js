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
cpu.assemble_bootcode(fs.readFileSync('os.asm', 'utf8'));
cpu.boot();
