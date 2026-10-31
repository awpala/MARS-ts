/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/dump/IntelHexDumpFormat.java. */
import { AbstractDumpFormat } from './AbstractDumpFormat.js';
import { Binary } from '../formatting/Binary.js';
import type { Globals } from '../Globals.js';

/** Legacy Intel HEX writer, including its relative addresses and word-byte order. */
export class IntelHexDumpFormat extends AbstractDumpFormat {
  /** Attach the only legacy format with a specified file extension. */
  constructor(machine: Globals) {
    super(machine, 'Intel hex format', 'HEX', 'Written as Intel Hex Memory File', 'hex');
  }
  /** Preserve Java's relative address width, checksums, uppercase records, and EOF record. */
  dumpMemoryRange(firstAddress: number, lastAddress: number): Uint8Array<ArrayBuffer> {
    const lines: string[] = [];
    for (const [address, word] of this.words(firstAddress, lastAddress)) {
      const offset = (address - firstAddress) | 0;
      let checksum = 4 + (offset & 255) + ((offset >>> 8) & 255);
      for (let i = 0; i < 4; i++) checksum += (word >>> (i * 8)) & 255;
      lines.push(
        (
          ':04' +
          Binary.intToPaddedUnsignedString(offset, 16, 4) +
          '00' +
          Binary.intToPaddedUnsignedString(word, 16, 8) +
          Binary.intToPaddedUnsignedString(-checksum & 255, 16, 2)
        ).toUpperCase()
      );
    }
    lines.push(':00000001FF');
    return this.text(lines);
  }
}
