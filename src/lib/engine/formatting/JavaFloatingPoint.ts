/**
 * Independent Java SE 21 Float/Double runtime compatibility adapter.
 * Implements the specified decimal selection and IEEE nearest-even rounding
 * with exact integer arithmetic; no OpenJDK implementation is copied.
 */
import { NumberFormatException } from './Binary.js';

type Fraction = { numerator: bigint; denominator: bigint };
type Format = {
  precision: number;
  exponentBits: number;
  bias: number;
  minimumExponent: number;
  maximumExponent: number;
  digits: number;
};
const FLOAT: Format = {
  precision: 24,
  exponentBits: 8,
  bias: 127,
  minimumExponent: -149,
  maximumExponent: 127,
  digits: 9
};
const DOUBLE: Format = {
  precision: 53,
  exponentBits: 11,
  bias: 1023,
  minimumExponent: -1074,
  maximumExponent: 1023,
  digits: 17
};

/** Exact Java floating text conversion, including direct single-precision parsing. */
export class JavaFloatingPoint {
  /** Render the single-precision value using Java's shortest-decimal selection. */
  static formatFloat(value: number): string {
    return JavaFloatingPoint.format(Math.fround(value), FLOAT);
  }
  /** Render a double using Java's shortest-decimal selection and notation thresholds. */
  static formatDouble(value: number): string {
    return JavaFloatingPoint.format(value, DOUBLE);
  }
  /** Parse Java decimal/hexadecimal floating syntax with one rounding to binary32. */
  static parseFloat(source: string): number {
    return JavaFloatingPoint.parse(source, FLOAT);
  }
  /** Parse Java decimal/hexadecimal floating syntax with one rounding to binary64. */
  static parseDouble(source: string): number {
    return JavaFloatingPoint.parse(source, DOUBLE);
  }

  private static parse(source: string, format: Format): number {
    // String.trim in Java removes code units <= U+0020, not Unicode whitespace.
    // eslint-disable-next-line no-control-regex -- Java trim deliberately includes ASCII control characters.
    const text = source.replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, '');
    if (/^[+-]?NaN$/.test(text)) return NaN;
    if (/^[+-]?Infinity$/.test(text)) return text[0] === '-' ? -Infinity : Infinity;
    const negative = text[0] === '-';
    const hex =
      /^([+-]?)0[xX]([0-9a-fA-F]+(?:\.[0-9a-fA-F]*)?|\.[0-9a-fA-F]+)[pP]([+-]?[0-9]+)[fFdD]?$/.exec(
        text
      );
    let fraction: Fraction;
    if (hex !== null) {
      const parts = hex[2].split('.');
      const coefficient = BigInt('0x' + parts.join(''));
      if (coefficient === 0n) return negative ? -0 : 0;
      const exponent = Number(hex[3]) - 4 * (parts[1]?.length ?? 0);
      const top = coefficient.toString(2).length - 1 + exponent;
      if (top > format.maximumExponent) return negative ? -Infinity : Infinity;
      if (top < format.minimumExponent - 1) return negative ? -0 : 0;
      fraction = this.binaryFraction(coefficient, exponent);
    } else {
      const decimal = /^([+-]?)([0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE]([+-]?[0-9]+))?[fFdD]?$/.exec(
        text
      );
      if (decimal === null) throw new NumberFormatException();
      const parts = decimal[2].split('.');
      let digits = parts.join('').replace(/^0+/, '');
      if (digits.length === 0) return negative ? -0 : 0;
      let exponent = Number(decimal[3] ?? '0') - (parts[1]?.length ?? 0);
      const order = digits.length - 1 + exponent;
      // These conservative outer bounds avoid constructing huge powers for
      // inputs such as 1e999999999; the boundaries still use exact rounding.
      const limit = format === FLOAT ? 60 : 400;
      if (order > limit) return negative ? -Infinity : Infinity;
      if (order < -limit) return negative ? -0 : 0;
      const trimmed = digits.replace(/0+$/, '');
      exponent += digits.length - trimmed.length;
      digits = trimmed;
      fraction = this.decimalFraction(BigInt(digits), exponent);
    }
    const value = this.roundToBinary(fraction, format);
    return negative ? -value : value;
  }
  private static roundToBinary(value: Fraction, format: Format): number {
    let exponent = value.numerator.toString(2).length - value.denominator.toString(2).length;
    if (
      exponent >= 0
        ? value.numerator < value.denominator << BigInt(exponent)
        : value.numerator << BigInt(-exponent) < value.denominator
    )
      exponent--;
    if (exponent > format.maximumExponent) return Infinity;
    if (exponent < format.minimumExponent - 1) return 0;
    const scale = Math.max(exponent - format.precision + 1, format.minimumExponent);
    const numerator = scale < 0 ? value.numerator << BigInt(-scale) : value.numerator;
    const denominator = scale > 0 ? value.denominator << BigInt(scale) : value.denominator;
    let coefficient = numerator / denominator;
    const twiceRemainder = 2n * (numerator % denominator);
    if (
      twiceRemainder > denominator ||
      (twiceRemainder === denominator && (coefficient & 1n) !== 0n)
    )
      coefficient++;
    const result = Number(coefficient) * 2 ** scale;
    return format === FLOAT ? Math.fround(result) : result;
  }
  private static format(value: number, format: Format): string {
    if (Number.isNaN(value)) return 'NaN';
    if (value === Infinity) return 'Infinity';
    if (value === -Infinity) return '-Infinity';
    if (value === 0) return Object.is(value, -0) ? '-0.0' : '0.0';
    const sign = value < 0 ? '-' : '';
    value = Math.abs(value);
    const buffer = new DataView(new ArrayBuffer(8));
    let bits: bigint;
    if (format === FLOAT) {
      buffer.setFloat32(0, value, false);
      bits = BigInt(buffer.getUint32(0, false));
    } else {
      buffer.setFloat64(0, value, false);
      bits = buffer.getBigUint64(0, false);
    }
    const exact = this.fractionFromBits(bits, format);
    const lower = this.midpoint(exact, this.fractionFromBits(bits - 1n, format));
    const upper = this.midpoint(exact, this.fractionFromBits(bits + 1n, format));
    const inclusive = (bits & 1n) === 0n;
    let order = Math.floor(Math.log10(value));
    while (this.compare(exact, this.decimalFraction(1n, order)) < 0) order--;
    while (this.compare(exact, this.decimalFraction(1n, order + 1)) >= 0) order++;
    // Java considers both one- and two-digit decimals when any one-digit
    // decimal round-trips. Searching from two digits implements that rule.
    for (let length = 2; length <= format.digits; length++) {
      const exponent = order - length + 1;
      const scale = this.decimalFraction(1n, exponent);
      const numerator = exact.numerator * scale.denominator;
      const denominator = exact.denominator * scale.numerator;
      const floor = numerator / denominator;
      let chosen: { coefficient: bigint; distance: bigint } | null = null;
      for (const coefficient of [floor, floor + 1n]) {
        if (coefficient === 0n) continue;
        const candidate = {
          numerator: coefficient * scale.numerator,
          denominator: scale.denominator
        };
        const lo = this.compare(candidate, lower),
          hi = this.compare(candidate, upper);
        if (lo < 0 || hi > 0 || (!inclusive && (lo === 0 || hi === 0))) continue;
        const delta = numerator - coefficient * denominator;
        const distance = delta < 0n ? -delta : delta;
        if (
          chosen === null ||
          distance < chosen.distance ||
          (distance === chosen.distance && (this.removeZeroes(coefficient).coefficient & 1n) === 0n)
        )
          chosen = { coefficient, distance };
      }
      if (chosen !== null) {
        const normalized = this.removeZeroes(chosen.coefficient);
        return sign + this.render(normalized.coefficient.toString(), exponent + normalized.zeroes);
      }
    }
    throw new Error('No round-tripping decimal within IEEE precision bound');
  }
  private static fractionFromBits(bits: bigint, format: Format): Fraction {
    const fractionBits = BigInt(format.precision - 1);
    const exponent = Number(bits >> fractionBits);
    const coefficient = bits & ((1n << fractionBits) - 1n);
    // The successor of the largest finite value supplies its overflow
    // rounding boundary; its mathematical value is 2^(maximumExponent+1).
    if (exponent === (1 << format.exponentBits) - 1)
      return this.binaryFraction(1n, format.maximumExponent + 1);
    if (exponent === 0) return this.binaryFraction(coefficient, format.minimumExponent);
    return this.binaryFraction(
      coefficient | (1n << fractionBits),
      exponent - format.bias - format.precision + 1
    );
  }
  private static binaryFraction(coefficient: bigint, exponent: number): Fraction {
    return exponent < 0
      ? { numerator: coefficient, denominator: 1n << BigInt(-exponent) }
      : { numerator: coefficient << BigInt(exponent), denominator: 1n };
  }
  private static decimalFraction(coefficient: bigint, exponent: number): Fraction {
    return exponent < 0
      ? { numerator: coefficient, denominator: 10n ** BigInt(-exponent) }
      : { numerator: coefficient * 10n ** BigInt(exponent), denominator: 1n };
  }
  private static midpoint(left: Fraction, right: Fraction): Fraction {
    return {
      numerator: left.numerator * right.denominator + right.numerator * left.denominator,
      denominator: 2n * left.denominator * right.denominator
    };
  }
  private static compare(left: Fraction, right: Fraction): number {
    const difference = left.numerator * right.denominator - right.numerator * left.denominator;
    return difference < 0n ? -1 : difference > 0n ? 1 : 0;
  }
  private static removeZeroes(coefficient: bigint): { coefficient: bigint; zeroes: number } {
    let zeroes = 0;
    while (coefficient % 10n === 0n) {
      coefficient /= 10n;
      zeroes++;
    }
    return { coefficient, zeroes };
  }
  private static render(digits: string, exponent: number): string {
    const order = digits.length + exponent - 1;
    if (order >= -3 && order < 0) return '0.' + '0'.repeat(-order - 1) + digits;
    if (order >= 0 && order < 7) {
      if (exponent >= 0) return digits + '0'.repeat(exponent) + '.0';
      const point = digits.length + exponent;
      return digits.substring(0, point) + '.' + digits.substring(point);
    }
    return digits[0] + '.' + (digits.substring(1) || '0') + 'E' + order;
  }
}
