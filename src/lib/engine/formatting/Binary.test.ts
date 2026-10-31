import { describe, expect, it } from 'vitest';
import { Binary } from './Binary.js';

describe('shared word representations', () => {
  it('pads unsigned radix output to a minimum width without clipping larger Intel HEX offsets', () => {
    expect(Binary.intToPaddedUnsignedString(0, 16, 4)).toBe('0000');
    expect(Binary.intToPaddedUnsignedString(-1, 16, 8)).toBe('ffffffff');
    expect(Binary.intToPaddedUnsignedString(-2147483648, 2, 32)).toBe('1' + '0'.repeat(31));
    expect(Binary.intToPaddedUnsignedString(0x10000, 16, 4)).toBe('10000');
    expect(Binary.intToPaddedUnsignedString(-4, 16, 4)).toBe('fffffffc');
  });

  it('renders addresses as unsigned decimal or prefixed eight-digit hexadecimal', () => {
    expect(Binary.formatUnsignedInteger(-2147483648, 10)).toBe('2147483648');
    expect(Binary.formatUnsignedInteger(-1, 10)).toBe('4294967295');
    expect(Binary.formatUnsignedInteger(0, 16)).toBe('0x00000000');
    expect(Binary.formatUnsignedInteger(-2147483648, 16)).toBe('0x80000000');
    expect(Binary.formatUnsignedInteger(-1, 16)).toBe('0xffffffff');
  });

  it('sign-extends low halfwords without retaining upper bits', () => {
    for (const [value, expected] of [
      [0, 0],
      [0x7fff, 32767],
      [0x8000, -32768],
      [0xffff, -1],
      [0x12340000, 0],
      [0x12348000, -32768],
      [-2147483648, 0],
      [-1, -1]
    ])
      expect(Binary.signExtend16(value), String(value)).toBe(expected);
  });
});
