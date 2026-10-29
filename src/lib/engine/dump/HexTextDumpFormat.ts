/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/dump/HexTextDumpFormat.java. */
import { AbstractDumpFormat } from './AbstractDumpFormat.js';
import type { Globals } from '../Globals.js';

/** Legacy Hexadecimal Text encoder, owned by its machine's dump workflow. */
export class HexTextDumpFormat extends AbstractDumpFormat {
  /** Attach the legacy format metadata to the supplied machine. */
  constructor(machine: Globals) {
    super(machine, 'Hexadecimal Text', 'HexText', 'Written as hex characters to text file', 'hex');
  }
  /** Encode one raw memory word per LF-terminated line. */
  dumpMemoryRange(firstAddress: number, lastAddress: number): Uint8Array<ArrayBuffer> {
    return this.text(
      [...this.words(firstAddress, lastAddress)].map(([, word]) =>
        (word >>> 0).toString(16).padStart(8, '0')
      )
    );
  }
}
