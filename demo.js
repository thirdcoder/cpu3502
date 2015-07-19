'use strict';

const CPU = require('./3502');
const {TRITS_PER_TRYTE, T_TO_TRITS_PER_TRYTE, TRYTES_PER_WORD, TRITS_PER_WORD, T_TO_TRITS_PER_WORD, MAX_TRYTE, MIN_TRYTE, MEMORY_SIZE} = require('./arch');
const {get_trit, set_trit, slice_trits} = require('trit-getset');
const Triterm = require('tritmapped-terminal');
const raf = require('raf');

// 4 trits in each dimension, xxxx and yyyy
const VIDEO_TRYTE_COUNT = 4;

// '00xxx xyyyy' address -> 'xxxxx' tritmap value
const T_TO_VIDEO_TRYTE_COUNT = Math.pow(3,VIDEO_TRYTE_COUNT);
const VIDEO_ADDRESS_SIZE = Math.pow((T_TO_VIDEO_TRYTE_COUNT * TRITS_PER_TRYTE), TRYTES_PER_WORD) / TRITS_PER_TRYTE;

const Memory = require('./memory');

const MAX_ADDRESS = (T_TO_TRITS_PER_WORD - 1) / 2;
const MIN_ADDRESS = -MAX_ADDRESS;

const VIDEO_ADDRESS_OFFSET = MAX_ADDRESS - VIDEO_ADDRESS_SIZE; // -3281
if (VIDEO_ADDRESS_SIZE + VIDEO_ADDRESS_OFFSET !== MAX_ADDRESS) throw new Error('wrong video address size');

const CHARGEN_ADDRESS = -3282; // 0i111 11110
const CURSOR_ROW_ADDRESS = -3283;
const CURSOR_COL_ADDRESS = -3284;

const TIMER_FREQUENCY_ADDRESS = -3285;
const BEEPER_ADDRESS = -3286;

const INT_VECTOR_N_ADDRESS = -29524; const INT_INPUT = -1;
const INT_VECTOR_Z_ADDRESS = -29522; const INT_START = 0;
const INT_VECTOR_P_ADDRESS = -29520; const INT_PULSE = 1;

const CODE_START_ADDRESS = -29518;

const memory = Memory({
  tryteCount: MEMORY_SIZE,
  map: {
    video: {
      start: VIDEO_ADDRESS_OFFSET,                      // -3281      0i111 11111
      end: VIDEO_ADDRESS_SIZE + VIDEO_ADDRESS_OFFSET,   // 29524, end 11111 11111
    },
    chargen: {
      start: CHARGEN_ADDRESS,
      end: CHARGEN_ADDRESS,
    },
    timer: {
      start: TIMER_FREQUENCY_ADDRESS,
      end: TIMER_FREQUENCY_ADDRESS,
    },
    beeper: {
      start: BEEPER_ADDRESS,
      end: BEEPER_ADDRESS,
    },
  }
});

console.log('memory.map',memory.map);

const term = Triterm({
  addressTryteSize: VIDEO_TRYTE_COUNT,
  tritmap: memory.subarray(memory.map.video.start, memory.map.video.end),
  handleInput: (tt, ev) => {
    if (Number.isInteger(tt)) {
      cpu.interrupt(INT_INPUT, tt);
    }
  },
});

memory.map.video.write = (address, value) => {
  // When writing to video, refresh the terminal canvas
  // TODO: optimize to throttle refresh? refresh rate 60 Hz?/requestAnimationFrame? dirty, only if changes?
  //console.log('video write:',address,value);
  term.tc.refresh();
};

memory.map.chargen.write = (address, value) => {
  console.log('chargen',value);

  let row = memory.read(CURSOR_ROW_ADDRESS);
  let col = memory.read(CURSOR_COL_ADDRESS);

  // wrap-around if row/col out of terminal range
  row %= term.rowCount; if (row < 0) row += term.rowCount;
  col %= term.colCount; if (col < 0) col += term.colCount;

  console.log('COLROW',col,row);

  term.setTTChar(value, col, row);
};

raf(function tick() {
  term.refresh();
  raf(tick);
});

// scanner beep from http://freesound.org/people/kalisemorrison/sounds/202530/ (CC-0)
const beepURL = 'data:audio/mp3;base64,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';
const beep = new Audio(beepURL);

memory.map.beeper.write = (address, value) => {
  console.log('beep',address,value);
  beep.play();
  // TODO: more sophisticated sound effects, synthesizer?
};

const cpu = CPU({
  memory: memory
});

let _timer;
memory.map.timer.write = (address, value) => {
  function fire() {
    let ms = memory.read(TIMER_FREQUENCY_ADDRESS) * 100;
    if (ms < 100) ms = 100;

    console.log(`TIMER FIRE, next=${ms} ms`);
    cpu.interrupt(INT_PULSE); // TODO: pass dt, time since previous fire?

    _timer = window.setTimeout(fire, ms);
  };

  if (_timer === undefined) fire();
};


global.cpu = cpu;

const assembler = require('./as');

let lines = [
    '.org '+CODE_START_ADDRESS,
    'LDA #$ijk',
    'LDA #%ii1i0',
    'LDA #&QF',
    'NOP',
    'NOP',
    'NOP',
    'LDA #0',
    'LDA #42',
    'STA 0',

    'LDA #%00i01',
    'PTI A',

    'TAX',

    "LDA #'X",

    '.equ -3282 chargen',
    '.equ -3283 row',
    '.equ -3284 col',

    '.equ -3286 beep',

    'STA chargen',

    'LDX #1',
    'STX col',
    'STA chargen',

    'LDX #1',
    'STX row',
    'LDX #2',
    'STX col',
    'STA chargen',

    'LDX #-1',
    'STX row',
    'STA chargen',


    'LDX #0',
    'STX row',
    'LDY #4',
    'STY col',
    'LDX #1',
    'STA chargen',

    'ADC #2',
    'NOT A',
    'STA chargen',  // trit-text red 'Z'

    'LDX #4',
    'INX',
    'STX col',
    'DEC chargen',  // trit-text 'Y'

    'TXA',  // X->A, 5

    // setup stack, since default 0 overlaps with memory-mapped screen output
    '.equ -10000 stack',
    'LDY #>stack',
    'LDX #<stack',
    'TXYS',

    // loop 6..19
    'loop:',
    'INC A',
    'STA col',
    'STA chargen',
    'CMP #20',
    //'BNE #-11',
    'BNE loop',

    'LDA #1',
    'STA row',
    'STZ col',

    // print greeting
    'LDA #<greeting',
    'LDX #>greeting',
    'JSR print_string',

    'INC row',
    'STZ col',

    'LDA #<prompt_string',
    'LDX #>prompt_string',
    'JSR print_string',

    //'STZ beep',

    // set input interrupt handler
    '.equ -29524 int_inputL',
    '.equ -29523 int_inputH',
    'LDA #<handle_input',
    'STA int_inputL',
    'LDA #>handle_input',
    'STA int_inputH',

    'SEIP', // enable interrupt -1 (keyboard input) TODO: also handle int 1, then can unmask all with CLI

    // set pulse interrupt handler
    '.equ -29520 int_pulseL',
    '.equ -29519 int_pulseH',
    'LDA #<handle_pulse',
    'STA int_pulseL',
    'LDA #>handle_pulse',
    'STA int_pulseH',

    'CLI',  // enable all interrupts

    "LDA #'_",               // a suitable cursor character
    //"LDA #'▒",            // alternative block cursor TODO: use in 'insert' mode?
    'STA cursor_char',

    '.equ -3285 timer_freq',
    'LDA #1', // 100 ms
    /* cursor blink - disable when want quiescence (noisy) */
    'STA timer_freq', // triggers interrupt immediately.. TODO: probably should delay! or never returns?
    /* */

    'HALTZ',

    'cursor_char:',
    ".tryte 0",

    'greeting:',
    '.data "Hello, world! ☺ 3502 CPU online: system readyWaiting for user input."',
    '.tryte 0',

    'prompt_string:',
    //TODO: support newlines in print_string '.tryte 12',  // trit-text newline TODO: support embedding in .data
    '.data "$ "',
    '.tryte 0',

    'bad_command_string:',
    '.data "Bad command or file name: "',
    '.tryte 0',

    'handle_pulse:',
    // blinking cursor
    'LDA cursor_char',
    'STA chargen',
    'NEG cursor_char',  // toggle red/green '_'
    'RTI',              // return from interrupt

    // subroutine to advance terminal to next line
    'next_line:',
    'INC row',
    'STZ col',
    'RTS',


    'handle_prev_line:',
    'DEC row',
    'LDA #44',    // TODO: .equ
    'STA col',
    'JMP handled_input',

    'handle_backspace:',
    'JSR truncate_line_buffer',
    'BCS handle_backspace_denied', // if couldn't delete
    'STZ chargen', // clear cursor
    'DEC col',
    'LDA col',
    'CMP #-1',
    'BEQ handle_prev_line',
    'STZ chargen',
    'JMP handled_input',

    'handle_backspace_denied:',
    'STZ beep',                 // user feedback that their backspacing was denied
    'JMP handled_input',

    'handle_enter:',
    'STZ chargen',    // clear cursor
    'JSR next_line',
    'LDA #<bad_command_string',
    'LDX #>bad_command_string',
    'JSR print_string',
    'LDA #<line_buffer',
    'LDX #>line_buffer',
    'JSR print_string',
    'JSR reset_line_buffer',
    'INC row',
    'STZ col',
    'LDA #<prompt_string',
    'LDX #>prompt_string',
    'JSR print_string',
    'JMP handled_input',

    // interrupt handler:
    'handle_input:',
    "CMP #'\\n",
    'BEQ handle_enter',
    'CMP #0',
    'BEQ handle_backspace',

    'JSR save_line_buffer_char',
    'JSR print_char',


    'handled_input:',
    'RTI',



    // append character in A to line_buffer
    'save_line_buffer_char:',
    'LDY line_buffer_offset',
    'STA line_buffer,Y',
    'INC line_buffer_offset',
    'INY',
    'LDX #0',
    'STX line_buffer,Y',  // null terminate
    'RTS',

    'line_buffer_offset:',
    '.tryte 0',

    // reset line buffer to empty string
    'reset_line_buffer:',
    'STZ line_buffer_offset',
    'STA line_buffer',
    'RTS',

    // delete last character of line buffer, sets carry flag if cannot be deleted
    'truncate_line_buffer:',
    'LDY line_buffer_offset',
    'DEY',
    'CPY #0',
    'BMI _truncate_line_buffer_skip',  // empty buffer, cannot truncate further
    'LDA #0',
    'STA line_buffer,Y',
    'STY line_buffer_offset',
    'CLC',
    'RTS',
    '_truncate_line_buffer_skip:',
    'SECN',
    'RTS',

    // print character in A to screen and advance cursor
    'print_char:',
    'STA chargen',
    'INC col',

    'LDX col',
    '.equ 45 row_count',
    'CPX #row_count',
    'BNE print_char_done',
    'JSR next_line',      // at last column, wrap cursor to next line

    'print_char_done:',
    'RTS',


    // print a null-terminated string pointed to by A,X
    'print_string:',
    'STA _print_string_param',
    'STX _print_string_param+1',
    'LDY #0',
    '_print_string_loop:',
    'LDA (_print_string_param),Y',
    'CMP #0',
    'BEQ _print_string_done',
    'JSR print_char',
    'INY',
    'BRA _print_string_loop',
    '_print_string_done:',
    'RTS',
    '_print_string_param:',
    '.word 0',


    'line_buffer:',
    '.tryte 0', // may extend further
];

cpu.memory.writeArray(CODE_START_ADDRESS, assembler(lines));
cpu.memory.write(INT_VECTOR_Z_ADDRESS, slice_trits(CODE_START_ADDRESS, 0, 5));
cpu.memory.write(INT_VECTOR_Z_ADDRESS + 1, slice_trits(CODE_START_ADDRESS, 5, 10));

//cpu.pc = cpu.read_int_vector(0);
//cpu.run();

cpu.interrupt(INT_START);

