/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/dump/AsciiTextDumpFormat.java. */
import { Binary } from '../formatting/Binary.js';
import { AbstractDumpFormat } from './AbstractDumpFormat.js';
import type { Globals } from '../Globals.js';

/** Legacy ASCII Text encoder, owned by its machine's dump workflow. */
export class AsciiTextDumpFormat extends AbstractDumpFormat {
  /** Attach the legacy format metadata to the supplied machine. */
  constructor(machine: Globals) {
    super(
      machine,
      'ASCII Text',
      'AsciiText',
      'Memory contents interpreted as ASCII characters',
      'txt'
    );
  }
  /** Encode one raw memory word per LF-terminated line. */
  dumpMemoryRange(firstAddress: number, lastAddress: number): Uint8Array<ArrayBuffer> {
    return this.text(
      [...this.words(firstAddress, lastAddress)].map(([, word]) => Binary.intToAscii(word))
    );
  }
}
