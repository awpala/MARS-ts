/*
Copyright (c) 2003-2013,  Pete Sanderson and Kenneth Vollmar

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
// Ports mars/assembler/TokenList.java.

import { Token } from './Token.js';

/** A source line's mutable token sequence and preprocessed display text. */
export class TokenList {
  private tokenList: Token[] = [];
  private processedLine = '';

  /** Record source text after textual preprocessing. */
  setProcessedLine(line: string): void {
    this.processedLine = line;
  }
  /** Return preprocessed source text, initially empty. */
  getProcessedLine(): string {
    return this.processedLine;
  }
  /** Return the token at a zero-based position; invalid positions throw RangeError. */
  get(position: number): Token {
    this.checkPosition(position);
    return this.tokenList[position];
  }
  /** Replace a token at an existing position; invalid positions throw RangeError. */
  set(position: number, replacement: Token): void {
    this.checkPosition(position);
    this.tokenList[position] = replacement;
  }
  /** Return the number of tokens. */
  size(): number {
    return this.tokenList.length;
  }
  /** Append a caller-owned token reference. */
  add(token: Token): void {
    this.tokenList.push(token);
  }
  /** Remove an existing position and shift following tokens left. */
  remove(position: number): void {
    this.checkPosition(position);
    this.tokenList.splice(position, 1);
  }
  /** Return whether the list contains no tokens. */
  isEmpty(): boolean {
    return this.tokenList.length === 0;
  }
  /** Return token values with one trailing space after each token. */
  toString(): string {
    return this.tokenList.map((token) => token.toString() + ' ').join('');
  }
  /** Return category names with one trailing space after each token. */
  toTypeString(): string {
    return this.tokenList.map((token) => token.getType().toString() + ' ').join('');
  }
  /** Clone the sequence and display text while sharing the original token objects. */
  clone(): TokenList {
    const clone = new TokenList();
    clone.tokenList = this.tokenList.slice();
    clone.processedLine = this.processedLine;
    return clone;
  }
  private checkPosition(position: number): void {
    if (!Number.isInteger(position) || position < 0 || position >= this.tokenList.length) {
      throw new RangeError(`Index ${position} out of bounds for length ${this.tokenList.length}`);
    }
  }
}
