/*
Copyright (c) 2003-2008,  Pete Sanderson and Kenneth Vollmar

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
// Ports mars/assembler/Token.java.

import type { DiagnosticProgram } from '../../diagnostics/ErrorMessage.js';

import type { TokenTypes } from './TokenTypes.js';

/** A token's category, value, and current/original source locations. */
export class Token {
  private originalMIPSprogram: DiagnosticProgram | null;
  private originalSourceLine: number;

  /** Retain caller-owned program and token-type identities; positions follow the lexer. */
  constructor(
    private type: TokenTypes,
    private readonly value: string,
    private readonly sourceMIPSprogram: DiagnosticProgram | null,
    private readonly sourceLine: number,
    private readonly sourcePos: number
  ) {
    this.originalMIPSprogram = sourceMIPSprogram;
    this.originalSourceLine = sourceLine;
  }
  /** Preserve the location before include expansion moves the token. */
  setOriginal(program: DiagnosticProgram | null, line: number): void {
    this.originalMIPSprogram = program;
    this.originalSourceLine = line;
  }
  /** Return the original caller-owned program, or null. */
  getOriginalProgram(): DiagnosticProgram | null {
    return this.originalMIPSprogram;
  }
  /** Return the original source line. */
  getOriginalSourceLine(): number {
    return this.originalSourceLine;
  }
  /** Return the current token category identity. */
  getType(): TokenTypes {
    return this.type;
  }
  /** Replace the category when an instruction spelling is recognized as a label. */
  setType(type: TokenTypes): void {
    this.type = type;
  }
  /** Return the exact token spelling. */
  getValue(): string {
    return this.value;
  }
  /** Return the exact token spelling. */
  toString(): string {
    return this.value;
  }
  /** Return the caller-owned program after include expansion, or null. */
  getSourceMIPSprogram(): DiagnosticProgram | null {
    return this.sourceMIPSprogram;
  }
  /** Return the current source line. */
  getSourceLine(): number {
    return this.sourceLine;
  }
  /** Return the starting character position supplied by the lexer. */
  getStartPos(): number {
    return this.sourcePos;
  }
}
