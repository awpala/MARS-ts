/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/dump/BinaryDumpFormat.java. */
import { AbstractDumpFormat } from './AbstractDumpFormat.js';
import type { Globals } from '../Globals.js';

/** Raw little-endian byte stream of raw words, independent of the configured memory byte order. */
export class BinaryDumpFormat extends AbstractDumpFormat {
  /** Attach the legacy binary metadata and browser file suggestion. */
  constructor(machine: Globals) {
    super(
      machine,
      'Binary',
      'Binary',
      'Written as byte stream to binary file',
      'bin',
      'application/octet-stream'
    );
  }
  /** Emit each raw word least-significant byte first, as the Java writer does. */
  dumpMemoryRange(firstAddress: number, lastAddress: number): Uint8Array<ArrayBuffer> {
    const bytes: number[] = [];
    for (const [, word] of this.words(firstAddress, lastAddress))
      for (let i = 0; i < 4; i++) bytes.push((word >>> (i * 8)) & 255);
    return Uint8Array.from(bytes);
  }
}
