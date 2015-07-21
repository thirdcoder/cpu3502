'use strict';

const CPU = require('./3502');

const installVideoHardware = require('./peripherals/video.js');
const installAudioHardware = require('./peripherals/audio.js');
const installTimerHardware = require('./peripherals/timer.js');

const cpu = CPU();

installVideoHardware(cpu);
installAudioHardware(cpu);
installTimerHardware(cpu);

global.cpu = cpu;

const fs = require('fs');
cpu.assemble_bootcode(fs.readFileSync('os.asm', 'utf8'));
cpu.boot();
