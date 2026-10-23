import { describe, expect, it } from 'vitest';
import {
  alignedBase,
  locateAddress,
  MEMORY_PAGE_BYTES,
  pageLimits,
  pagedOffset,
  pageStart,
  type SegmentBases
} from './memoryView.js';

const bases: SegmentBases = {
  data: 0x10010000,
  extern: 0x10000000,
  heap: 0x10040000,
  gp: 0x10008000,
  sp: 0x7fffeffc,
  text: 0x00400000,
  kernel: 0x90000000 | 0,
  mmio: 0xffff0000 | 0
};

const between = (address: number, low: number, high: number) =>
  address >>> 0 >= low >>> 0 && address >>> 0 < high >>> 0;
const memory = {
  inTextSegment: (address: number) => between(address, 0x00400000, 0x10000000),
  inKernelTextSegment: (address: number) => between(address, 0x80000000, 0x90000000),
  inKernelDataSegment: (address: number) => between(address, 0x90000000, 0xffff0000),
  inMemoryMapSegment: (address: number) => between(address, 0xffff0000, 0xffffffff)
};

const bounds = {
  kernelTextBaseAddress: 0x80000000 | 0,
  kernelDataBaseAddress: 0x90000000 | 0,
  textBaseAddress: 0x00400000,
  dataSegmentBaseAddress: 0x10000000,
  dataBaseAddress: 0x10010000,
  kernelHighAddress: 0xfffffffc | 0,
  userHighAddress: 0x7fffeffc
};

describe('page addressing', () => {
  it('aligns range bases to words and applies the relative offset', () => {
    expect(alignedBase({ ...bases, gp: 0x10008003 }, 'gp')).toBe(0x10008000);
    expect(pageStart(bases, 'data', MEMORY_PAGE_BYTES)).toBe(0x10010200);
  });
});

describe('locateAddress', () => {
  it('shows text addresses in the text range on their page', () => {
    expect(locateAddress(memory, bases, 0x00400000, 'data')).toEqual({
      segment: 'text',
      pageOffset: 0,
      textLabel: true
    });
    expect(locateAddress(memory, bases, 0x00400408, 'data')).toMatchObject({
      segment: 'text',
      pageOffset: 2 * MEMORY_PAGE_BYTES
    });
  });
  it('shows kernel data and memory-mapped addresses in their own ranges', () => {
    expect(locateAddress(memory, bases, 0x90000010, 'data')).toMatchObject({
      segment: 'kernel',
      textLabel: false
    });
    expect(locateAddress(memory, bases, 0xffff0004 | 0, 'data')).toMatchObject({
      segment: 'mmio'
    });
  });
  it('chooses the nearest eligible base for other addresses', () => {
    expect(locateAddress(memory, bases, 0x10010004, 'extern')).toEqual({
      segment: 'data',
      pageOffset: 0,
      textLabel: false
    });
    expect(locateAddress(memory, bases, 0x10010204, 'extern').pageOffset).toBe(MEMORY_PAGE_BYTES);
  });
});

describe('pageLimits and pagedOffset', () => {
  it('bounds user ranges by the lowest user base and the user high address', () => {
    const limits = pageLimits(bounds, 'data', 0x10010000);
    expect(limits.low).toBe(0x00400000);
    expect(limits.high).toBe(0x7fffeffc - MEMORY_PAGE_BYTES + 1);
  });
  it('bounds kernel ranges and linked kernel text by their own bases', () => {
    expect(pageLimits(bounds, 'kernel', 0x90000000 | 0).low).toBe(0x90000000);
    expect(pageLimits(bounds, 'text', 0x80000000 | 0).low).toBe(0x80000000);
    expect(pageLimits(bounds, 'text', 0x00400000).low).toBe(0x00400000);
  });
  it('moves by whole pages and clamps at the limits', () => {
    const limits = { low: 0x10000000, high: 0x10010400 };
    expect(pagedOffset(bases, 'data', 0x10010000, MEMORY_PAGE_BYTES, limits)).toBe(
      MEMORY_PAGE_BYTES
    );
    expect(pagedOffset(bases, 'data', 0x10010000, -0x20000, limits)).toBe(0x10000000 - 0x10010000);
    expect(pagedOffset(bases, 'data', 0x10010000, 0x20000, limits)).toBe(0x400);
  });
});
