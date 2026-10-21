/*
Copyright (c) 2003-2012,  Pete Sanderson and Kenneth Vollmar

Developed by Pete Sanderson (psanderson@otterbein.edu)
and Kenneth Vollmar (kenvollmar@missouristate.edu)

Permission is hereby granted, free of charge, to any person obtaining 
a copy of this software and associated documentation files (the 
"Software"), to deal in the Software without restriction, including 
without limitation the rights to use, copy, modify, merge, publish, 
distribute, sublicense, and/or sell copies of the Software, and to 
permit persons to whom the Software is furnished to do so, subject 
to the following conditions:

The above copyright notice and this permission notice shall be 
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, 
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR 
ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF 
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION 
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

(MIT license, http://www.opensource.org/licenses/mit-license.html)
 */
// Ports mars/assembler/Directives.java.

/** Immutable directive identities and help text in canonical declaration order. */
export class Directives {
  /** Subsequent items stored in Data segment at next available address. */
  static readonly DATA = new Directives(
    '.data',
    'Subsequent items stored in Data segment at next available address'
  );
  /** Subsequent items (instructions) stored in Text segment at next available address. */
  static readonly TEXT = new Directives(
    '.text',
    'Subsequent items (instructions) stored in Text segment at next available address'
  );
  /** Store the listed value(s) as 32 bit words on word boundary. */
  static readonly WORD = new Directives(
    '.word',
    'Store the listed value(s) as 32 bit words on word boundary'
  );
  /** Store the string in the Data segment but do not add null terminator. */
  static readonly ASCII = new Directives(
    '.ascii',
    'Store the string in the Data segment but do not add null terminator'
  );
  /** Store the string in the Data segment and add null terminator. */
  static readonly ASCIIZ = new Directives(
    '.asciiz',
    'Store the string in the Data segment and add null terminator'
  );
  /** Store the listed value(s) as 8 bit bytes. */
  static readonly BYTE = new Directives('.byte', 'Store the listed value(s) as 8 bit bytes');
  /** Align next data item on specified byte boundary (0=byte, 1=half, 2=word, 3=double). */
  static readonly ALIGN = new Directives(
    '.align',
    'Align next data item on specified byte boundary (0=byte, 1=half, 2=word, 3=double)'
  );
  /** Store the listed value(s) as 16 bit halfwords on halfword boundary. */
  static readonly HALF = new Directives(
    '.half',
    'Store the listed value(s) as 16 bit halfwords on halfword boundary'
  );
  /** Reserve the next specified number of bytes in Data segment. */
  static readonly SPACE = new Directives(
    '.space',
    'Reserve the next specified number of bytes in Data segment'
  );
  /** Store the listed value(s) as double precision floating point. */
  static readonly DOUBLE = new Directives(
    '.double',
    'Store the listed value(s) as double precision floating point'
  );
  /** Store the listed value(s) as single precision floating point. */
  static readonly FLOAT = new Directives(
    '.float',
    'Store the listed value(s) as single precision floating point'
  );
  /** Declare the listed label and byte length to be a global data field. */
  static readonly EXTERN = new Directives(
    '.extern',
    'Declare the listed label and byte length to be a global data field'
  );
  /** Subsequent items stored in Kernel Data segment at next available address. */
  static readonly KDATA = new Directives(
    '.kdata',
    'Subsequent items stored in Kernel Data segment at next available address'
  );
  /** Subsequent items (instructions) stored in Kernel Text segment at next available address. */
  static readonly KTEXT = new Directives(
    '.ktext',
    'Subsequent items (instructions) stored in Kernel Text segment at next available address'
  );
  /** Declare the listed label(s) as global to enable referencing from other files. */
  static readonly GLOBL = new Directives(
    '.globl',
    'Declare the listed label(s) as global to enable referencing from other files'
  );
  /** Set assembler variables.  Currently ignored but included for SPIM compatability. */
  static readonly SET = new Directives(
    '.set',
    'Set assembler variables.  Currently ignored but included for SPIM compatability'
  );
  /** Substitute second operand for first. First operand is symbol, second operand is expression (like #define). */
  static readonly EQV = new Directives(
    '.eqv',
    'Substitute second operand for first. First operand is symbol, second operand is expression (like #define)'
  );
  /** Begin macro definition.  See .end_macro. */
  static readonly MACRO = new Directives('.macro', 'Begin macro definition.  See .end_macro');
  /** End macro definition.  See .macro. */
  static readonly END_MACRO = new Directives('.end_macro', 'End macro definition.  See .macro');
  /** Insert the contents of the specified file.  Put filename in quotes.. */
  static readonly INCLUDE = new Directives(
    '.include',
    'Insert the contents of the specified file.  Put filename in quotes.'
  );
  private static readonly directiveList = Object.freeze([
    Directives.DATA,
    Directives.TEXT,
    Directives.WORD,
    Directives.ASCII,
    Directives.ASCIIZ,
    Directives.BYTE,
    Directives.ALIGN,
    Directives.HALF,
    Directives.SPACE,
    Directives.DOUBLE,
    Directives.FLOAT,
    Directives.EXTERN,
    Directives.KDATA,
    Directives.KTEXT,
    Directives.GLOBL,
    Directives.SET,
    Directives.EQV,
    Directives.MACRO,
    Directives.END_MACRO,
    Directives.INCLUDE
  ]);

  private constructor(
    private readonly descriptor: string,
    private readonly description: string
  ) {
    Object.freeze(this);
  }

  /** Find a directive using Java's case-insensitive character comparison. */
  static matchDirective(value: string): Directives | null {
    for (const directive of this.directiveList) {
      const name = directive.descriptor;
      if (value.length !== name.length) continue;
      let matches = true;
      for (let i = 0; i < name.length; i++) {
        const character = value.charAt(i);
        const expected = name.charAt(i);
        // Java Character uses a single-character lowercase mapping for dotted I.
        if (
          character !== expected &&
          character.toUpperCase() !== expected.toUpperCase() &&
          character.toLowerCase() !== expected &&
          !(character === '\u0130' && expected === 'i')
        ) {
          matches = false;
          break;
        }
      }
      if (matches) return directive;
    }
    return null;
  }

  /** Return matching identities in declaration order, or null when none match. */
  static prefixMatchDirectives(value: string): Directives[] | null {
    const matches = this.directiveList.filter((directive) =>
      directive.descriptor.toLowerCase().startsWith(value.toLowerCase())
    );
    return matches.length === 0 ? null : matches;
  }

  /** Return the canonical directive spelling. */
  toString(): string {
    return this.descriptor;
  }

  /** Return the canonical directive spelling. */
  getName(): string {
    return this.descriptor;
  }

  /** Return the legacy help text. */
  getDescription(): string {
    return this.description;
  }

  /** Return shared immutable directive metadata, preserving declaration order. */
  static getDirectiveList(): readonly Directives[] {
    return this.directiveList;
  }

  /** Test whether a directive stores integer values. */
  static isIntegerDirective(directive: Directives | null): boolean {
    return directive === this.WORD || directive === this.HALF || directive === this.BYTE;
  }

  /** Test whether a directive stores floating-point values. */
  static isFloatingDirective(directive: Directives | null): boolean {
    return directive === this.FLOAT || directive === this.DOUBLE;
  }
}
