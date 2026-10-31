import { describe, expect, it } from 'vitest';
import foundation from '../../../../tests/oracle/units/foundation.json';
import { JavaCharacter } from './JavaCharacter.js';

describe('Java character runtime compatibility', () => {
  it('trims every Java trim code unit while preserving internal controls and Unicode whitespace', () => {
    const controls = Array.from({ length: 33 }, (_, code) => String.fromCharCode(code)).join('');
    expect(JavaCharacter.trim(controls + 'a\0b' + controls)).toBe('a\0b');
    expect(JavaCharacter.trim(controls)).toBe('');
    expect(JavaCharacter.trim('')).toBe('');
    for (const character of ['!', '\u00a0', '\u1680', '\u2003', '\u2028', '\u2029', '\ufeff', '𝟙'])
      expect(JavaCharacter.trim(controls + character + controls), character).toBe(character);
  });

  it('matches decimal values for every BMP code unit using the independent JDK digit capture', () => {
    const decimalDigits = new Map<number, number>();
    for (const row of foundation.stdout.trimEnd().split('\n')) {
      const match = /^digit:(\d+)=(\d+)$/.exec(row);
      if (match !== null && Number(match[2]) < 10)
        decimalDigits.set(Number(match[1]), Number(match[2]));
    }
    expect(decimalDigits.size).toBe(370);
    const mismatches: string[] = [];
    for (let code = 0; code <= 0xffff; code++) {
      const expected = decimalDigits.get(code) ?? -1;
      const actual = JavaCharacter.decimalDigitValue(String.fromCharCode(code));
      if (actual !== expected) mismatches.push(`${code}: ${actual} != ${expected}`);
    }
    expect(mismatches).toEqual([]);
    expect(JavaCharacter.decimalDigitValue('')).toBe(-1);
    expect(JavaCharacter.decimalDigitValue('𝟙')).toBe(-1);
  });
});
