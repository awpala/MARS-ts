import { describe, expect, it } from 'vitest';
import { exportFilenames } from './exportFilenames.js';

const names = (inputs: string[]) =>
  exportFilenames(inputs.map((name) => ({ name, source: name }))).map((file) => file.name);

describe('exportFilenames', () => {
  it('keeps each recognized assembly extension, lowercased', () => {
    expect(names(['main.asm', 'legacy.s', 'UPPER.ASM', 'Mixed.S'])).toEqual([
      'main.asm',
      'legacy.s',
      'UPPER.asm',
      'Mixed.s'
    ]);
  });
  it('gives names without a recognized extension the default one', () => {
    expect(names(['notes.txt', 'plain', 'dir/inner.mips'])).toEqual([
      'notes.asm',
      'plain.asm',
      'inner.asm'
    ]);
  });
  it('flattens paths and numbers repeated names before the extension', () => {
    expect(names(['a/util.s', 'b/util.s', 'util.s', 'util.asm', 'util.asm'])).toEqual([
      'util.s',
      'util-2.s',
      'util-3.s',
      'util.asm',
      'util-2.asm'
    ]);
  });
  it('keeps the exact source text', () => {
    expect(exportFilenames([{ name: 'x.s', source: 'li $t0, 1\n' }])).toEqual([
      { name: 'x.s', source: 'li $t0, 1\n' }
    ]);
  });
});
