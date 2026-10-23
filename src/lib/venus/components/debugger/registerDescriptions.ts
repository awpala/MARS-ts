/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Descriptions derive from mars/venus/RegistersWindow.java, Coprocessor0Window.java, and Coprocessor1Window.java. */
import type { RegisterBank } from '#lib/browser/DesktopSession.js';

const temporary = 'temporary (not preserved across call)';
const saved = 'saved temporary (preserved across call)';
const result = 'expression evaluation and results of a function';
const kernel = 'reserved for OS kernel';
const unreferenced = 'should not be referenced explicitly in your program';

/** Even-numbered floating registers; each is followed by an odd register that holds the other half of a double. */
const floatingEven = [
  'floating point subprogram return value',
  'floating point subprogram return value',
  temporary,
  temporary,
  temporary,
  temporary,
  'floating point subprogram argument 1',
  'floating point subprogram argument 2',
  temporary,
  temporary,
  saved,
  saved,
  saved,
  saved,
  saved,
  saved
];

/** Name-column hover description of every register, in display order, for each register bank. */
export const registerDescriptions: Readonly<Record<RegisterBank, readonly string[]>> = {
  Registers: [
    'constant 0',
    'reserved for assembler',
    result,
    result,
    'argument 1',
    'argument 2',
    'argument 3',
    'argument 4',
    ...Array<string>(8).fill(temporary),
    ...Array<string>(8).fill(saved),
    temporary,
    temporary,
    kernel,
    kernel,
    'pointer to global area',
    'stack pointer',
    'frame pointer',
    'return address (used by function call)',
    'program counter',
    'high-order word of multiply product, or divide remainder',
    'low-order word of multiply product, or divide quotient'
  ],
  'Coproc 0': [
    'Memory address at which address exception occurred',
    'Interrupt mask and enable bits',
    'Exception type and pending interrupt bits',
    'Address of instruction that caused exception'
  ],
  'Coproc 1': floatingEven.flatMap((description) => [description, unreferenced])
};
