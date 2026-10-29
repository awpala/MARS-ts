/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/util/MemoryDump.java and the populated-range selection in mars/venus/FileDumpMemoryAction.java. */
import type { Globals } from '../Globals.js';
import { AddressErrorException } from '../hardware/memory/AddressErrorException.js';

/** One populated GUI dump range; endpoints include the word beginning at lastAddress. */
export interface DumpSegment {
  /** Legacy segment name. */
  name: '.text' | '.data';
  /** First word address in the configured layout. */
  firstAddress: number;
  /** Last word before the first unallocated instruction or data block. */
  lastAddress: number;
}

/** Per-machine segment discovery; retains no mutable caches, registrations, or I/O. */
export class MemoryDump {
  /** Read the current memory layout and sparse allocation from this session. */
  constructor(private readonly machine: Globals) {}

  /** Offer populated .text and .data ranges in legacy order; omit ranges with invalid or empty starts. */
  getSegments(): readonly DumpSegment[] {
    const memory = this.machine.memory;
    const ranges: DumpSegment[] = [];
    for (const [name, base, limit] of [
      ['.text', memory.textBaseAddress, memory.textLimitAddress],
      ['.data', memory.dataBaseAddress, memory.dataSegmentLimitAddress]
    ] as const) {
      try {
        const lastAddress = memory.getAddressOfFirstNull(base, limit) - 4;
        if (lastAddress >= base) ranges.push({ name, firstAddress: base, lastAddress });
      } catch (error) {
        if (!(error instanceof AddressErrorException)) throw error;
      }
    }
    return ranges;
  }
}
