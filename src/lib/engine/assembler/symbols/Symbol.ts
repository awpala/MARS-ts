/*
Copyright (c) 2003-2006,  Pete Sanderson and Kenneth Vollmar

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
// Ports mars/assembler/Symbol.java.

/** A program-owned label, its signed 32-bit address, and segment kind. */
export class Symbol {
  /** Text-segment symbol marker. */
  static readonly TEXT_SYMBOL = false;
  /** Data-segment symbol marker. */
  static readonly DATA_SYMBOL = true;

  private address: number;

  /** Create a label owned by its containing program's symbol table. */
  constructor(
    private readonly name: string,
    address: number,
    private readonly data: boolean
  ) {
    this.address = address | 0;
  }

  /** Return the address as a signed Java int. */
  getAddress(): number {
    return this.address;
  }

  /** Return the original case-sensitive label. */
  getName(): string {
    return this.name;
  }

  /** Return true for data symbols and false for text symbols. */
  getType(): boolean {
    return this.data;
  }

  /** Replace the address, preserving Java int normalization. */
  setAddress(address: number): void {
    this.address = address | 0;
  }
}
