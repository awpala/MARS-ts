/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/dump/BinaryTextDumpFormat.java. */
import { AbstractDumpFormat } from './AbstractDumpFormat.js';
import { Binary } from '../formatting/Binary.js';
import type { Globals } from '../Globals.js';

/** Legacy Binary Text encoder, owned by its machine's dump workflow. */
export class BinaryTextDumpFormat extends AbstractDumpFormat {
  /** Attach the legacy format metadata to the supplied machine. */
  constructor(machine: Globals) {
    super(
      machine,
      'Binary Text',
      'BinaryText',
      "Written as '0' and '1' characters to text file",
      'txt'
    );
  }
  /** Encode one raw memory word per LF-terminated line. */
  dumpMemoryRange(firstAddress: number, lastAddress: number): Uint8Array<ArrayBuffer> {
    return this.text(
      [...this.words(firstAddress, lastAddress)].map(([, word]) =>
        Binary.intToPaddedUnsignedString(word, 2, 32)
      )
    );
  }
}
