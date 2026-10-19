import { describe, expect, it } from 'vitest';
import golden from '../../../../tests/oracle/floating-units/golden.json';
import { JavaFloatingPoint } from './JavaFloatingPoint.js';
import { NumberFormatException } from './Binary.js';

const rows = golden.stdout
	.trimEnd()
	.split('\n')
	.map((line) => line.split('\t'));
function floatFromBits(bits: string): number {
	const view = new DataView(new ArrayBuffer(4));
	view.setUint32(0, parseInt(bits, 16));
	return view.getFloat32(0);
}
function doubleFromBits(bits: string): number {
	const view = new DataView(new ArrayBuffer(8));
	view.setBigUint64(0, BigInt('0x' + bits));
	return view.getFloat64(0);
}
function floatBits(value: number): string {
	if (Number.isNaN(value)) return '7fc00000';
	const view = new DataView(new ArrayBuffer(4));
	view.setFloat32(0, value);
	return view.getUint32(0).toString(16);
}
function doubleBits(value: number): string {
	if (Number.isNaN(value)) return '7ff8000000000000';
	const view = new DataView(new ArrayBuffer(8));
	view.setFloat64(0, value);
	return view.getBigUint64(0).toString(16);
}
describe('Java SE 21 floating runtime compatibility', () => {
	it('formats binary32 across every exponent, extremes, signs and seeded raw patterns', () => {
		for (const [kind, bits, expected] of rows)
			if (kind === 'F')
				expect(JavaFloatingPoint.formatFloat(floatFromBits(bits)), bits).toBe(expected);
	}, 60000);
	it('formats binary64 across every exponent, adjacent values, signs and seeded raw patterns', () => {
		for (const [kind, bits, expected] of rows)
			if (kind === 'D')
				expect(JavaFloatingPoint.formatDouble(doubleFromBits(bits)), bits).toBe(expected);
	}, 60000);
	it('parses Java decimal/hex grammar with exact direct binary32 and binary64 rounding', () => {
		for (const [kind, encoded, float, double] of rows)
			if (kind === 'P') {
				const source = Buffer.from(encoded, 'base64').toString('utf8');
				if (float === 'error')
					expect(() => JavaFloatingPoint.parseFloat(source), source).toThrow(NumberFormatException);
				else expect(floatBits(JavaFloatingPoint.parseFloat(source)), source).toBe(float);
				if (double === 'error')
					expect(() => JavaFloatingPoint.parseDouble(source), source).toThrow(
						NumberFormatException
					);
				else expect(doubleBits(JavaFloatingPoint.parseDouble(source)), source).toBe(double);
			}
	}, 60000);
	it('can be injected as detached runtime conversion callbacks', () => {
		const { formatFloat, formatDouble, parseFloat, parseDouble } = JavaFloatingPoint;
		expect(formatFloat(parseFloat('1.4e-45'))).toBe('1.4E-45');
		expect(formatDouble(parseDouble('4.9e-324'))).toBe('4.9E-324');
	});
	it('avoids intermediate binary64 rounding when parsing single precision', () => {
		const source = '1.0000000596046447753906250001';
		expect(floatBits(JavaFloatingPoint.parseFloat(source))).toBe('3f800001');
		expect(floatBits(Math.fround(JavaFloatingPoint.parseDouble(source)))).toBe('3f800000');
	});
});
