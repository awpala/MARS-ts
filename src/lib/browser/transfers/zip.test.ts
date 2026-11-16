import { describe, expect, it } from 'vitest';
import { crc32, readZip, writeZip } from './zip.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function bytes(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await blob.arrayBuffer());
}

async function deflate(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return bytes(
    await new Response(
      new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    ).blob()
  );
}

/** Rewrites one little-endian field of both headers of the first stored entry in a writeZip archive. */
function patchFirstEntry(
  archive: Uint8Array<ArrayBuffer>,
  localOffset: number,
  value: number,
  width: 2 | 4
) {
  const view = new DataView(archive.buffer);
  const central = archive.length - 22 - view.getUint32(archive.length - 22 + 12, true);
  const set = (offset: number) =>
    width === 2 ? view.setUint16(offset, value, true) : view.setUint32(offset, value, true);
  set(localOffset);
  set(central + localOffset + 2);
}

describe('ZIP archives', () => {
  it('computes the standard CRC-32 check value', () => {
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926);
  });

  it('round-trips stored UTF-8 entries in order', async () => {
    const archive = await bytes(
      writeZip([
        { name: 'main.asm', data: encoder.encode('.text\nnop\n') },
        { name: 'lib/こんにちは.s', data: encoder.encode('# unicode\n') }
      ])
    );
    const entries = readZip(archive);
    expect(entries.map((entry) => [entry.name, entry.directory, entry.size])).toEqual([
      ['main.asm', false, 10],
      ['lib/こんにちは.s', false, 10]
    ]);
    expect(decoder.decode(await entries[1].read())).toBe('# unicode\n');
  });

  it('lists directory markers and finds the directory behind an archive comment', async () => {
    const stored = await bytes(
      writeZip([
        { name: 'src/', data: new Uint8Array() },
        { name: 'src/main.asm', data: encoder.encode('main: nop\n') }
      ])
    );
    const comment = encoder.encode(
      'PK\x05\x06 is an end-record lookalike inside this archive comment'
    );
    const archive = new Uint8Array(stored.length + comment.length);
    archive.set(stored);
    archive.set(comment, stored.length);
    new DataView(archive.buffer).setUint16(stored.length - 2, comment.length, true);
    const entries = readZip(archive);
    expect(entries.map((entry) => [entry.name, entry.directory])).toEqual([
      ['src/', true],
      ['src/main.asm', false]
    ]);
    expect(decoder.decode(await entries[1].read())).toBe('main: nop\n');
  });

  it('inflates raw DEFLATE data and rejects data that disagrees with its checksum', async () => {
    const data = encoder.encode('loop: b loop\n'.repeat(20));
    const compressed = await deflate(data);
    const archive = await bytes(writeZip([{ name: 'loop.asm', data: compressed }]));
    // Turn the stored entry into a deflated one with the uncompressed size and checksum.
    patchFirstEntry(archive, 8, 8, 2);
    patchFirstEntry(archive, 14, crc32(data), 4);
    patchFirstEntry(archive, 22, data.length, 4);
    expect(decoder.decode(await readZip(archive)[0].read())).toBe(decoder.decode(data));
    patchFirstEntry(archive, 14, crc32(data) ^ 1, 4);
    await expect(readZip(archive)[0].read()).rejects.toThrow('The archive entry is corrupt.');
  });

  it('reports encrypted, unsupported, and truncated entries with readable reasons', async () => {
    const make = async () => bytes(writeZip([{ name: 'a.asm', data: encoder.encode('nop\n') }]));
    const encrypted = await make();
    patchFirstEntry(encrypted, 6, 0x0801, 2);
    await expect(readZip(encrypted)[0].read()).rejects.toThrow(
      'Encrypted ZIP entries are not supported.'
    );
    const bzip2 = await make();
    patchFirstEntry(bzip2, 8, 12, 2);
    await expect(readZip(bzip2)[0].read()).rejects.toThrow(
      'Uses unsupported ZIP compression (method 12).'
    );
    const oversized = await make();
    patchFirstEntry(oversized, 18, 1 << 20, 4);
    await expect(readZip(oversized)[0].read()).rejects.toThrow('The archive entry is corrupt.');
  });

  it('rejects non-archives, split archives, and ZIP64 archives', async () => {
    expect(() => readZip(encoder.encode('not a zip at all, just text'))).toThrow(
      'Not a readable ZIP archive.'
    );
    const split = await bytes(writeZip([]));
    new DataView(split.buffer).setUint16(4, 1, true);
    expect(() => readZip(split)).toThrow('Split ZIP archives are not supported.');
    const zip64 = await bytes(writeZip([]));
    new DataView(zip64.buffer).setUint32(16, 0xffffffff, true);
    expect(() => readZip(zip64)).toThrow('ZIP64 archives are not supported.');
  });
});
