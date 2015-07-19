'use strict';

const CPU = require('./3502');
const {TRITS_PER_TRYTE, T_TO_TRITS_PER_TRYTE, TRYTES_PER_WORD, TRITS_PER_WORD, T_TO_TRITS_PER_WORD, MAX_TRYTE, MIN_TRYTE, MEMORY_SIZE} = require('./arch');
const {get_trit, set_trit, slice_trits} = require('trit-getset');
const Triterm = require('tritmapped-terminal');

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
  // TODO: write to row,col from another memory address value (no trap needed). -3282, -3283? - for cursor
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
    'LDA #0',
    'STA col',

    // print greeting
    'LDA #<greeting',
    'LDX #>greeting',
    'JSR print_string',

    'INC row',
    'LDA #0',
    'STA col',

    'LDA #<prompt_string',
    'LDX #>prompt_string',
    'JSR print_string',


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
    'LDA #0',
    'STA col',
    'RTS',


    'handle_prev_line:',
    'DEC row',
    'LDA #44',    // TODO: .equ
    'STA col',
    'JMP handled_input',

    'handle_backspace:',
    'LDA #0',
    'STA chargen', // clear cursor
    'DEC col',
    'LDA col',
    'CMP #-1',
    'BEQ handle_prev_line',
    'LDA #0',     // null to erase TODO: space?
    'STA chargen',
    'JSR truncate_line_buffer',
    'JMP handled_input',

    'handle_enter:',
    'JSR next_line',
    'LDA #<bad_command_string',
    'LDX #>bad_command_string',
    'JSR print_string',
    'LDA #<line_buffer',
    'LDX #>line_buffer',
    'JSR print_string',
    'JSR reset_line_buffer',
    'INC row',
    'LDA #0',
    'STA col',
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
    'LDA #0',
    'STA line_buffer_offset',
    'STA line_buffer',
    'RTS',

    // delete last character of line buffer
    'truncate_line_buffer:',
    'DEC line_buffer_offset', // TODO: check if underflow
    'LDY line_buffer_offset',
    'LDA #0',
    'STA line_buffer,Y',
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

