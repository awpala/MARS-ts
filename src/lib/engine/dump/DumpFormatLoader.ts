/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/dump/DumpFormatLoader.java. */
import type { Globals } from '../Globals.js';
import { AsciiTextDumpFormat } from './AsciiTextDumpFormat.js';
import { BinaryDumpFormat } from './BinaryDumpFormat.js';
import { BinaryTextDumpFormat } from './BinaryTextDumpFormat.js';
import { HexTextDumpFormat } from './HexTextDumpFormat.js';
import { IntelHexDumpFormat } from './IntelHexDumpFormat.js';
import { SegmentWindowDumpFormat } from './SegmentWindowDumpFormat.js';
import type { AbstractDumpFormat } from './AbstractDumpFormat.js';

/** Explicit registry replacing Java classpath discovery; MIF is disabled in the canonical implementation. */
export class DumpFormatLoader {
  /** Create independent format instances bound to the supplied machine, in legacy discovery order. */
  loadDumpFormats(machine: Globals): readonly AbstractDumpFormat[] {
    return [
      new AsciiTextDumpFormat(machine),
      new BinaryDumpFormat(machine),
      new BinaryTextDumpFormat(machine),
      new HexTextDumpFormat(machine),
      new IntelHexDumpFormat(machine),
      new SegmentWindowDumpFormat(machine)
    ];
  }
}
