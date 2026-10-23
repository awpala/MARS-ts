/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Range and paging rules derive from mars/venus/DataSegmentWindow.java. */
import type { MemorySegment } from '#lib/browser/DesktopSession.js';
import type { Globals } from '#lib/engine/Globals.js';
import { AddressErrorException } from '#lib/engine/hardware/memory/AddressErrorException.js';
import { Settings } from '#lib/engine/Settings.js';
import { clamp } from '../geometry/clamp.js';

/** Rows in one Data Segment page. */
export const MEMORY_ROWS = 16;
/** Words in one Data Segment row. */
export const MEMORY_COLUMNS = 8;
/** Bytes in one Data Segment row. */
export const MEMORY_ROW_BYTES = MEMORY_COLUMNS * 4;
/** Bytes in one Data Segment page. */
export const MEMORY_PAGE_BYTES = MEMORY_ROWS * MEMORY_ROW_BYTES;

/** Base address of every selectable Data Segment range. */
export type SegmentBases = Readonly<Record<MemorySegment, number>>;

/** Memory capabilities needed to place an address in a range. */
type SegmentLookup = Pick<
  Globals['memory'],
  'inTextSegment' | 'inKernelTextSegment' | 'inKernelDataSegment' | 'inMemoryMapSegment'
>;

/** Memory capabilities needed to bound the pages of a range. */
type PageBounds = Pick<
  Globals['memory'],
  | 'kernelTextBaseAddress'
  | 'kernelDataBaseAddress'
  | 'textBaseAddress'
  | 'dataSegmentBaseAddress'
  | 'dataBaseAddress'
  | 'kernelHighAddress'
  | 'userHighAddress'
>;

/** Current base of each range; $gp and $sp follow the registers' present values. */
export function segmentBases(machine: Globals): SegmentBases {
  const memory = machine.memory;
  const registers = machine.registerFile.getRegisters();
  return {
    data: memory.dataBaseAddress,
    extern: memory.externBaseAddress,
    heap: memory.heapBaseAddress,
    gp: registers[28].getValueNoNotify(),
    sp: registers[29].getValueNoNotify(),
    text: memory.textBaseAddress,
    kernel: memory.kernelDataBaseAddress,
    mmio: memory.memoryMapBaseAddress
  };
}

/** Word-aligned start of a range. */
export function alignedBase(bases: SegmentBases, segment: MemorySegment): number {
  return bases[segment] & ~3;
}

/** First address of the page a range and relative page offset display. */
export function pageStart(bases: SegmentBases, segment: MemorySegment, pageOffset: number): number {
  return (alignedBase(bases, segment) + pageOffset) | 0;
}

/** Lowest and highest first addresses of a page for a range; linked kernel-text labels share the text selector with user instructions. */
export function pageLimits(
  memory: PageBounds,
  segment: MemorySegment,
  start: number
): { low: number; high: number } {
  const kernelText = segment === 'text' && start >>> 0 >= memory.kernelTextBaseAddress >>> 0;
  const kernel = kernelText || segment === 'kernel' || segment === 'mmio';
  return {
    low: kernelText
      ? memory.kernelTextBaseAddress >>> 0
      : kernel
        ? memory.kernelDataBaseAddress >>> 0
        : Math.min(
            memory.textBaseAddress,
            memory.dataSegmentBaseAddress,
            memory.dataBaseAddress
          ) >>> 0,
    high:
      ((kernel ? memory.kernelHighAddress : memory.userHighAddress) >>> 0) - MEMORY_PAGE_BYTES + 1
  };
}

/** Relative page offset after moving `bytes` from the page starting at `start`, clamped to the range's limits. */
export function pagedOffset(
  bases: SegmentBases,
  segment: MemorySegment,
  start: number,
  bytes: number,
  limits: { low: number; high: number }
): number {
  return (
    clamp((start >>> 0) + bytes, limits.low, limits.high) - (alignedBase(bases, segment) >>> 0)
  );
}

/**
 * Choose the range and page that show an address. Text addresses use the text range, kernel data and memory-mapped addresses their own,
 * and anything else the nearest eligible base at or below it, with ties keeping the earlier range and no eligible base keeping `current`.
 * Pages keep the range's boundaries rather than placing every label in the first row.
 */
export function locateAddress(
  memory: SegmentLookup,
  bases: SegmentBases,
  address: number,
  current: MemorySegment
): { segment: MemorySegment; pageOffset: number; textLabel: boolean } {
  const textLabel = memory.inTextSegment(address) || memory.inKernelTextSegment(address);
  let segment = current;
  if (textLabel) segment = 'text';
  else if (memory.inKernelDataSegment(address)) segment = 'kernel';
  else if (memory.inMemoryMapSegment(address)) segment = 'mmio';
  else {
    let shortest = 0x7fffffff;
    for (const range of ['extern', 'gp', 'data', 'heap', 'sp'] as const) {
      const distance =
        range === 'gp' || range === 'sp'
          ? Math.abs(address - bases[range])
          : address - bases[range];
      if (distance >= 0 && distance < shortest) {
        shortest = distance;
        segment = range;
      }
    }
  }
  const base = bases[segment] & ~(MEMORY_ROW_BYTES - 1);
  const pageBase = base + Math.floor((address - base) / MEMORY_PAGE_BYTES) * MEMORY_PAGE_BYTES;
  return { segment, pageOffset: pageBase - alignedBase(bases, segment), textLabel };
}

/**
 * Read a word for display without notifying observers. Kernel text shows the live statement's code, and a text-segment read that
 * self-modifying-code protection would refuse is allowed temporarily, as DataSegmentWindow does solely for display. Other unreadable addresses show zero.
 */
export function readDisplayWord(machine: Globals, address: number): number {
  return machine.withGuiAccess(() => {
    if (machine.memory.inKernelTextSegment(address))
      return machine.memory.getStatementNoNotify(address)?.getBinaryStatement() ?? 0;
    try {
      return machine.memory.getWordNoNotify(address);
    } catch (error) {
      if (!(error instanceof AddressErrorException)) throw error;
      const settings = machine.getSettings();
      const enabled = settings.getBooleanSetting(Settings.SELF_MODIFYING_CODE_ENABLED);
      if (machine.memory.inTextSegment(address) && !enabled) {
        settings.setBooleanSettingNonPersistent(Settings.SELF_MODIFYING_CODE_ENABLED, true);
        try {
          return machine.memory.getWordNoNotify(address);
        } catch (readError) {
          if (!(readError instanceof AddressErrorException)) throw readError;
        } finally {
          settings.setBooleanSettingNonPersistent(Settings.SELF_MODIFYING_CODE_ENABLED, enabled);
        }
      }
      return 0;
    }
  });
}
