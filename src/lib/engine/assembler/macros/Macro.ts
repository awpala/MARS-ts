/*
Copyright (c) 2013-2014.

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
// Ports mars/assembler/Macro.java.
// MARS copyright Pete Sanderson and Kenneth Vollmar; macro implementation by M.H. Sekhavat.

import type { DiagnosticProgram } from '../../diagnostics/ErrorMessage.js';
import { ErrorMessage } from '../../diagnostics/ErrorMessage.js';
import { ErrorList } from '../../diagnostics/ErrorList.js';
import type { RegisterFile } from '../../hardware/registers/RegisterFile.js';
import type { Coprocessor0 } from '../../hardware/registers/Coprocessor0.js';
import type { Coprocessor1 } from '../../hardware/registers/Coprocessor1.js';
import { Token } from '../tokenization/Token.js';
import { TokenList } from '../tokenization/TokenList.js';

/** Register lookup dependencies owned by the enclosing simulator session. */
export interface MacroRegisters {
  /** General-register lookup used to exclude register spellings from SPIM parameters. */
  registerFile: Pick<RegisterFile, 'getUserRegister'>;
  /** System-register lookup used to exclude CP0 register spellings. */
  coprocessor0: Pick<Coprocessor0, 'getRegister'>;
  /** Floating-point register lookup used to exclude CP1 register spellings. */
  coprocessor1: Pick<Coprocessor1, 'getRegister'>;
}

/** Source and token access consumed by macro expansion; the program remains caller-owned. */
export interface MacroProgram extends DiagnosticProgram {
  /** Return the program's tokenized source lines. */
  getTokenList(): readonly TokenList[] | null;
  /** Return source text for a one-based line, or null outside the source range. */
  getSourceLine(line: number): string | null;
}

/** A macro definition, its parameters, labels, and original/expanded source locations. */
export class Macro {
  private name = '';
  private program: MacroProgram | null = null;
  private labels: string[] = [];
  private fromLine = 0;
  private toLine = 0;
  private origFromLine = 0;
  private origToLine = 0;
  private args: string[] = [];

  /** Bind the owning session's register lookup services. */
  constructor(private readonly registers: MacroRegisters) {}
  /** Return the macro name, initially empty. */
  getName(): string {
    return this.name;
  }
  /** Set the case-sensitive macro name. */
  setName(name: string): void {
    this.name = name;
  }
  /** Return the defining caller-owned program, or null before assignment. */
  getProgram(): MacroProgram | null {
    return this.program;
  }
  /** Assign the defining caller-owned program. */
  setProgram(program: MacroProgram | null): void {
    this.program = program;
  }
  /** Return the expanded source line of the opening directive. */
  getFromLine(): number {
    return this.fromLine;
  }
  /** Return the original source line of the opening directive. */
  getOriginalFromLine(): number {
    return this.origFromLine;
  }
  /** Assign the expanded opening line. */
  setFromLine(line: number): void {
    this.fromLine = line | 0;
  }
  /** Assign the original opening line. */
  setOriginalFromLine(line: number): void {
    this.origFromLine = line | 0;
  }
  /** Return the expanded source line of the closing directive. */
  getToLine(): number {
    return this.toLine;
  }
  /** Return the original source line of the closing directive. */
  getOriginalToLine(): number {
    return this.origToLine;
  }
  /** Assign the expanded closing line. */
  setToLine(line: number): void {
    this.toLine = line | 0;
  }
  /** Assign the original closing line. */
  setOriginalToLine(line: number): void {
    this.origToLine = line | 0;
  }
  /** Return the mutable parameter list owned by this definition. */
  getArgs(): string[] {
    return this.args;
  }
  /** Retain the supplied parameter list by reference, as in Java. */
  setArgs(args: string[]): void {
    this.args = args;
  }
  /** Compare macro name and parameter count, ignoring parameter spellings and source lines. */
  equals(other: unknown): boolean {
    return other instanceof Macro
      ? other.getName() === this.name && other.args.length === this.args.length
      : other === this;
  }
  /** Append a parameter spelling. */
  addArg(value: string): void {
    this.args.push(value);
  }

  /** Expand one definition line; substitution retains Java's first-string-occurrence behavior. */
  getSubstitutedLine(
    line: number,
    args: TokenList,
    counter: bigint,
    errors: ErrorList
  ): string | null {
    if (this.program === null) throw new TypeError('Macro program is null');
    const tokens = this.program.getTokenList()![line - 1];
    if (tokens === undefined) throw new RangeError('Macro source line index out of bounds');
    let source = this.program.getSourceLine(line);
    for (let i = tokens.size() - 1; i >= 0; i--) {
      const token = tokens.get(i);
      if (Macro.tokenIsMacroParameter(token.getValue(), true, this.registers)) {
        const replacement = this.args.indexOf(token.getValue());
        let substitute = token.getValue();
        if (replacement !== -1) substitute = args.get(replacement + 1).toString();
        else
          errors.add(
            new ErrorMessage(
              this.program,
              token.getSourceLine(),
              token.getStartPos(),
              'Unknown macro parameter'
            )
          );
        source = this.replaceToken(source, token, substitute);
      } else if (this.tokenIsMacroLabel(token.getValue())) {
        source = this.replaceToken(
          source,
          token,
          token.getValue() + '_M' + BigInt.asIntN(64, counter)
        );
      }
    }
    return source;
  }

  /** Recognize percent parameters and optional SPIM dollar parameters, excluding real registers. */
  static tokenIsMacroParameter(
    value: string,
    acceptSpimStyleParameters: boolean,
    registers: MacroRegisters
  ): boolean {
    if (
      acceptSpimStyleParameters &&
      value.length > 0 &&
      value.charAt(0) === '$' &&
      registers.registerFile.getUserRegister(value) === null &&
      registers.coprocessor0.getRegister(value) === null &&
      registers.coprocessor1.getRegister(value) === null
    )
      return true;
    return value.length > 1 && value.charAt(0) === '%';
  }
  /** Add a macro-local label; readyForCommit must sort labels before expansion. */
  addLabel(value: string): void {
    this.labels.push(value);
  }
  /** Sort labels using Java UTF-16 string ordering before committing the definition. */
  readyForCommit(): void {
    this.labels.sort();
  }

  private tokenIsMacroLabel(value: string): boolean {
    let low = 0;
    let high = this.labels.length - 1;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      const label = this.labels[middle];
      if (label < value) low = middle + 1;
      else if (label > value) high = middle - 1;
      else return true;
    }
    return false;
  }
  private replaceToken(source: string | null, token: Token, substitute: string): string {
    if (source === null) throw new TypeError('Macro source text is null');
    const value = token.getValue();
    const position = source.indexOf(value);
    return position < 0
      ? source
      : source.substring(0, position) + substitute + source.substring(position + value.length);
  }
}
