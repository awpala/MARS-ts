import { describe, expect, it } from 'vitest';
import { IMPORT_FILE_ACCEPT, IMPORT_SOURCE_LIMIT, readSourceImport } from './sourceImport.js';
import { writeZip } from './zip.js';

const encoder = new TextEncoder();

function archive(name: string, entries: Record<string, string>): File {
  return new File(
    [
      writeZip(
        Object.entries(entries).map(([path, text]) => ({ name: path, data: encoder.encode(text) }))
      )
    ],
    name
  );
}

describe('source import selections', () => {
  it('offers assembly sources and ZIP archives in the picker', () => {
    expect(IMPORT_FILE_ACCEPT).toBe('.asm,.s,.zip');
  });

  it('keeps directly selected sources and archive entries, with archive paths, in selection order', async () => {
    const plan = await readSourceImport([
      new File(['main: nop\n'], 'main.asm'),
      archive('project.ZIP', {
        'project/': '',
        'project/lib/macros.s': '.macro done\n.end_macro\n',
        'project/UPPER.ASM': '# upper\n'
      })
    ]);
    expect(plan).toEqual({
      sources: [
        { name: 'main.asm', source: 'main: nop\n', archive: undefined },
        {
          name: 'project/lib/macros.s',
          source: '.macro done\n.end_macro\n',
          archive: 'project.ZIP'
        },
        { name: 'project/UPPER.ASM', source: '# upper\n', archive: 'project.ZIP' }
      ],
      skipped: []
    });
  });

  it('skips other files and entries, unsafe paths, and later duplicates, each with a reason', async () => {
    const plan = await readSourceImport([
      new File(['notes'], 'notes.txt'),
      new File(['first\n'], 'dup.asm'),
      archive('bundle.zip', {
        'README.md': '# readme',
        'dup.asm': 'second\n',
        '../escape.asm': 'outside\n',
        '__MACOSX/._dup.asm': 'resource fork',
        'nested.zip': ''
      })
    ]);
    expect(plan.sources).toEqual([{ name: 'dup.asm', source: 'first\n', archive: undefined }]);
    expect(plan.skipped).toEqual([
      {
        name: 'notes.txt',
        archive: undefined,
        reason: 'Not an assembly source (.asm or .s) or ZIP archive.'
      },
      { name: 'README.md', archive: 'bundle.zip', reason: 'Not an assembly source (.asm or .s).' },
      {
        name: 'dup.asm',
        archive: 'bundle.zip',
        reason: 'Another selected source has the same name.'
      },
      {
        name: '../escape.asm',
        archive: 'bundle.zip',
        reason: 'Source filenames must stay within the library.'
      },
      { name: 'nested.zip', archive: 'bundle.zip', reason: 'Not an assembly source (.asm or .s).' }
    ]);
  });

  it('skips unreadable and empty archives as a whole', async () => {
    const plan = await readSourceImport([
      new File(['plain text'], 'broken.zip'),
      archive('folders.zip', { 'empty/': '' })
    ]);
    expect(plan.sources).toEqual([]);
    expect(plan.skipped).toEqual([
      { name: 'broken.zip', archive: undefined, reason: 'Not a readable ZIP archive.' },
      { name: 'folders.zip', archive: undefined, reason: 'The archive contains no files.' }
    ]);
  });

  it('skips a corrupt archive entry without affecting its valid siblings', async () => {
    const bytes = new Uint8Array(
      await writeZip([
        { name: 'bad.asm', data: encoder.encode('corrupted\n') },
        { name: 'good.asm', data: encoder.encode('fine\n') }
      ]).arrayBuffer()
    );
    bytes[30 + 'bad.asm'.length] ^= 0xff;
    const plan = await readSourceImport([new File([bytes], 'mixed.zip')]);
    expect(plan.sources).toEqual([{ name: 'good.asm', source: 'fine\n', archive: 'mixed.zip' }]);
    expect(plan.skipped).toEqual([
      { name: 'bad.asm', archive: 'mixed.zip', reason: 'The archive entry is corrupt.' }
    ]);
  });

  it('skips a source above the import size limit', async () => {
    const large = new File([new Uint8Array(IMPORT_SOURCE_LIMIT + 1)], 'large.asm');
    const plan = await readSourceImport([large]);
    expect(plan.sources).toEqual([]);
    expect(plan.skipped).toEqual([
      { name: 'large.asm', archive: undefined, reason: 'Larger than the 16 MiB import limit.' }
    ]);
  });
});
