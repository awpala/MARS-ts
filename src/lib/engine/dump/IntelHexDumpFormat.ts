/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/dump/IntelHexDumpFormat.java. */
import { AbstractDumpFormat } from './AbstractDumpFormat.js';
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
          (offset >>> 0).toString(16).padStart(4, '0') +
          '00' +
          (word >>> 0).toString(16).padStart(8, '0') +
          (-checksum & 255).toString(16).padStart(2, '0')
        ).toUpperCase()
      );
    }
    lines.push(':00000001FF');
    return this.text(lines);
  }
}
