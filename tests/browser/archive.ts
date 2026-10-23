import { execFileSync } from 'node:child_process';
import { crc32, deflateRawSync } from 'node:zlib';

/** Verify a downloaded ZIP archive and return its entries in stored order with their UTF-8 text. */
export function readArchive(path: string): { name: string; source: string }[] {
  execFileSync('unzip', ['-t', path]);
  const names = execFileSync('unzip', ['-Z1', path], { encoding: 'utf8' }).trimEnd().split('\n');
  return names.map((name) => ({
    name,
    source: execFileSync('unzip', ['-p', path, name], { encoding: 'utf8' })
  }));
}

/** Build a ZIP archive whose file entries are DEFLATE-compressed, as common archivers write them; names ending in `/` are directories. */
export function deflatedArchive(entries: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [path, text] of Object.entries(entries)) {
    const name = Buffer.from(path);
    const data = Buffer.from(text);
    const compressed = path.endsWith('/') ? data : deflateRawSync(data);
    const header = Buffer.alloc(26);
    header.writeUInt16LE(20, 0);
    header.writeUInt16LE(0x0800, 2);
    header.writeUInt16LE(path.endsWith('/') ? 0 : 8, 4);
    header.writeUInt16LE(0x0021, 8);
    header.writeUInt32LE(crc32(data), 10);
    header.writeUInt32LE(compressed.length, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt16LE(name.length, 22);
    const local = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), header, name, compressed]);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    header.copy(central, 6);
    central.writeUInt32LE(offset, 42);
    locals.push(local);
    centrals.push(central, name);
    offset += local.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
