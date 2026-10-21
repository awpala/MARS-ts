/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/util/Binary.java and the ASCII display table in Config.properties. */

/** Java-compatible integer parsing failure. */
export class NumberFormatException extends Error {
  /** Creates the same named exception used by the legacy parser. */
  constructor() {
    super();
    this.name = 'NumberFormatException';
  }
}

/** Bit conversions; words are signed 32-bit numbers and longs are signed 64-bit bigints. */
export class Binary {
  /** Formats low bits, retaining Java's modulo-32 shift behavior for longer lengths. */
  static intToBinaryString(value: number, length = 32): string {
    if (length < 0) throw new RangeError('NegativeArraySizeException');
    return Array.from({ length }, (_, i) => String(Binary.bitValue(value, length - i - 1))).join(
      ''
    );
  }
  /** Formats long bits with modulo-64 shifts. */
  static longToBinaryString(value: bigint, length = 64): string {
    if (length < 0) throw new RangeError('NegativeArraySizeException');
    return Array.from({ length }, (_, i) => String(Binary.bitValue(value, length - i - 1))).join(
      ''
    );
  }
  /** Decodes bits using the legacy unchecked character arithmetic. */
  static binaryStringToInt(value: string): number {
    if (!value.length) throw new RangeError('StringIndexOutOfBoundsException');
    let result = value.charCodeAt(0) - 48;
    for (let i = 1; i < value.length; i++) result = (result << 1) | (value.charCodeAt(i) - 48);
    return result;
  }
  /** Decodes bits with signed 64-bit wrap. */
  static binaryStringToLong(value: string): bigint {
    if (!value.length) throw new RangeError('StringIndexOutOfBoundsException');
    let result = BigInt(value.charCodeAt(0) - 48);
    for (let i = 1; i < value.length; i++)
      result = BigInt.asIntN(64, (result << 1n) | BigInt(value.charCodeAt(i) - 48));
    return result;
  }
  /** Formats arbitrary-length bits as hexadecimal with a 0x prefix. */
  static binaryStringToHexString(value: string): string {
    let result = '';
    for (let end = value.length; end > 0; end -= 4)
      result = Binary.binaryStringToHexDigit(value.slice(Math.max(0, end - 4), end)) + result;
    return '0x' + result;
  }
  /** Expands recognized hexadecimal digits; legacy ignores other characters. */
  static hexStringToBinaryString(value: string): string {
    return value
      .replace(/^0[xX]/, '')
      .split('')
      .map((c) => (/^[0-9a-f]$/i.test(c) ? Binary.intToBinaryString(parseInt(c, 16), 4) : ''))
      .join('');
  }
  /** Returns a nibble digit, treating every character except 1 as zero. */
  static binaryStringToHexDigit(value: string): string {
    if (value.length > 4) return '0';
    let result = 0;
    for (const c of value) result = (result << 1) | (c === '1' ? 1 : 0);
    return result.toString(16);
  }
  /** Formats an unsigned eight-digit hexadecimal word. */
  static intToHexString(value: number): string {
    return '0x' + (value >>> 0).toString(16).padStart(8, '0');
  }
  /** Formats the low halfword. */
  static intToHalfHexString(value: number): string {
    return '0x' + (value & 0xffff).toString(16).padStart(4, '0');
  }
  /** Formats a sixteen-digit hexadecimal long. */
  static longToHexString(value: bigint): string {
    return Binary.binaryStringToHexString(Binary.longToBinaryString(value));
  }
  /** Formats a signed word as unsigned decimal. */
  static unsignedIntToIntString(value: number): string {
    return String(value >>> 0);
  }
  /** Formats four bytes with the canonical MARS ASCII display escapes. */
  static intToAscii(value: number): string {
    const special: Readonly<Record<number, string>> = {
      0: '\\0',
      8: '\\b',
      9: '\\t',
      10: '\\n',
      11: '\\v',
      12: '\\f',
      13: '\\r'
    };
    return [3, 2, 1, 0]
      .map((i) => {
        const b = Binary.getByte(value, i);
        return (special[b] ?? (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).padStart(
          3,
          ' '
        );
      })
      .join('');
  }
  private static digit(character: string): number {
    const code = character.charCodeAt(0);
    // JDK 21 Character.digit(char, 16): BMP decimal blocks and Latin hex letters.
    const decimalStarts = [
      0x30, 0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66,
      0xde6, 0xe50, 0xed0, 0xf20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90,
      0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0, 0xa9f0, 0xaa50, 0xabf0, 0xff10
    ];
    for (const start of decimalStarts) if (code >= start && code < start + 10) return code - start;
    for (const start of [0x41, 0x61, 0xff21, 0xff41])
      if (code >= start && code < start + 6) return code - start + 10;
    return -1;
  }
  private static decode(value: string, width: number): bigint {
    let work = value;
    let sign = 1n;
    if (work.startsWith('-') || work.startsWith('+')) {
      if (work[0] === '-') sign = -1n;
      work = work.slice(1);
    }
    let radix = 10;
    if (/^0x/i.test(work)) {
      radix = 16;
      work = work.slice(2);
    } else if (work.startsWith('#')) {
      radix = 16;
      work = work.slice(1);
    } else if (work.startsWith('0') && work.length > 1) {
      radix = 8;
      work = work.slice(1);
    }
    if (!work.length) throw new NumberFormatException();
    let result = 0n;
    for (const c of work) {
      const digit = Binary.digit(c);
      if (digit < 0 || digit >= radix) throw new NumberFormatException();
      result = result * BigInt(radix) + BigInt(digit);
    }
    result *= sign;
    if (BigInt.asIntN(width, result) !== result) throw new NumberFormatException();
    return result;
  }
  /**
   * Whether the first code unit permits an integer parse attempt, including the legacy empty-string zero.
   * True does not validate the remaining characters; false lets callers skip an otherwise guaranteed exception.
   */
  static isIntegerCandidate(value: string): boolean {
    if (value.length === 0) return true;
    const first = value.charAt(0);
    if (first === '+' || first === '-' || first === '#') return true;
    if (first.charCodeAt(0) < 128) return first >= '0' && first <= '9';
    const digit = Binary.digit(first);
    return digit >= 0 && digit < 10;
  }
  /** Parses Java decode syntax, two's-complement hex, and the legacy wrapping decimal fallback. */
  static stringToInt(value: string): number {
    try {
      return Number(Binary.decode(value, 32));
    } catch {
      /* Legacy fallback below intentionally accepts empty strings and decimal overflow. */
    }
    if (/^0x[0-9a-f]{8}$/i.test(value)) return Number(BigInt.asIntN(32, BigInt(value)));
    if (!/^0x/i.test(value) && /^[0-9]*$/.test(value)) {
      let result = 0;
      for (const c of value) result = (Math.imul(result, 10) + Number(c)) | 0;
      return result;
    }
    throw new NumberFormatException();
  }
  /** Parses Java long syntax and unsigned sixteen-digit hex. */
  static stringToLong(value: string): bigint {
    try {
      return Binary.decode(value, 64);
    } catch {
      /* Legacy two's-complement fallback. */
    }
    if (/^0x[0-9a-f]{16}$/i.test(value)) return BigInt.asIntN(64, BigInt(value));
    throw new NumberFormatException();
  }
  /** Extracts signed high word. */
  static highOrderLongToInt(value: bigint): number {
    return Number(BigInt.asIntN(32, value >> 32n));
  }
  /** Extracts signed low word. */
  static lowOrderLongToInt(value: bigint): number {
    return Number(BigInt.asIntN(32, value));
  }
  /** Combines two word bit patterns into a signed long. */
  static twoIntsToLong(high: number, low: number): bigint {
    return BigInt.asIntN(64, (BigInt(high | 0) << 32n) | BigInt(low >>> 0));
  }
  /** Reads a bit with Java's masked shift distance. */
  static bitValue(value: number | bigint, bit: number): number {
    return typeof value === 'bigint'
      ? Number((value >> BigInt(bit & 63)) & 1n)
      : (value >> bit) & 1;
  }
  /** Sets a word bit. */
  static setBit(value: number, bit: number): number {
    return value | (1 << bit);
  }
  /** Clears a word bit. */
  static clearBit(value: number, bit: number): number {
    return value & ~(1 << bit);
  }
  /** Replaces a byte, least-significant byte numbered zero. */
  static setByte(value: number, bite: number, replacement: number): number {
    return (value & ~(255 << (bite << 3))) | ((replacement & 255) << (bite << 3));
  }
  /** Extracts an unsigned byte. */
  static getByte(value: number, bite: number): number {
    return (value << ((3 - bite) << 3)) >>> 24;
  }
  /** Recognizes legacy hex syntax, including its negative-hex classification defect. */
  static isHex(value: string): boolean {
    try {
      Binary.stringToInt(value);
    } catch {
      try {
        Binary.stringToLong(value);
      } catch {
        return false;
      }
    }
    return /^0x/i.test(value);
  }
  /** Recognizes legacy octal classification, including decimal fallback and negative zero. */
  static isOctal(value: string): boolean {
    try {
      Binary.stringToInt(value);
    } catch {
      return false;
    }
    return (
      !Binary.isHex(value) &&
      (value.startsWith('-0') || (value.startsWith('0') && value.length > 1))
    );
  }
}
