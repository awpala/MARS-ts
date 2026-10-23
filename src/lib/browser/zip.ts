/** Byte-wise CRC-32 lookup table for the IEEE 802.3 polynomial ZIP uses. */
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc;
});

/** CRC-32 checksum of bytes, as stored in ZIP headers. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** One named file for a ZIP archive. */
export interface ZipInput {
  /** Entry path; the writer encodes it as UTF-8 and does not add directory entries. */
  name: string;
  /** Exact entry contents. */
  data: Uint8Array<ArrayBuffer>;
}

/** Builds an uncompressed (stored) ZIP archive; callers supply unique entry names. */
export function writeZip(files: readonly ZipInput[]): Blob {
  const encoder = new TextEncoder();
  const entries: BlobPart[] = [];
  const directory: BlobPart[] = [];
  let offset = 0;
  let directorySize = 0;
  if (files.length > 0xffff) throw new Error('Too many sources for a ZIP archive.');
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = file.data;
    if (name.length > 0xffff || offset + 30 + name.length + data.length > 0xffffffff) {
      throw new Error('Sources exceed the ZIP archive size limit.');
    }
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names; stored entries need no compression.
    local.setUint16(12, 0x0021, true); // January 1, 1980, the DOS date epoch.
    local.setUint32(14, crc32(data), true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    entries.push(local.buffer, name, data);
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 0x0314, true); // Unix origin prevents DOS filename recoding by ZIP readers.
    new Uint8Array(central.buffer, 6, 26).set(new Uint8Array(local.buffer, 4, 26));
    central.setUint32(42, offset, true);
    directory.push(central.buffer, name);
    directorySize += 46 + name.length;
    offset += 30 + name.length + data.length;
  }
  if (offset + directorySize > 0xffffffff)
    throw new Error('Sources exceed the ZIP archive size limit.');
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  return new Blob([...entries, ...directory, end.buffer], { type: 'application/zip' });
}

/** One central-directory entry of a read archive; its data is extracted and verified only on request. */
export interface ZipEntry {
  /** Entry path exactly as the archive names it, with `/` separators. */
  name: string;
  /** Whether the entry is a directory marker rather than a file. */
  directory: boolean;
  /** Declared uncompressed size in bytes. */
  size: number;
  /** Extracts the contents, rejecting encrypted, unsupported, or corrupt entries with a readable reason. */
  read: () => Promise<Uint8Array<ArrayBuffer>>;
}

const END_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;
const CORRUPT_ENTRY = 'The archive entry is corrupt.';
const utf8 = new TextDecoder('utf-8', { fatal: true });
const lenientUtf8 = new TextDecoder();
const latin1 = new TextDecoder('windows-1252');

/**
 * Lists the entries of a single-disk ZIP archive without extracting them. Stored and deflated entries are supported; archive-level
 * damage, split archives, and ZIP64 archives are rejected with a readable error.
 */
export function readZip(bytes: Uint8Array<ArrayBuffer>): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end record follows the entries; a comment of up to 64 KiB may follow it and may itself contain the signature bytes.
  let end = -1;
  for (
    let position = bytes.length - 22;
    position >= Math.max(0, bytes.length - 22 - 0xffff);
    position--
  ) {
    if (view.getUint32(position, true) !== END_SIGNATURE) continue;
    if (end < 0) end = position;
    if (position + 22 + view.getUint16(position + 20, true) === bytes.length) {
      end = position;
      break;
    }
  }
  if (end < 0) throw new Error('Not a readable ZIP archive.');
  if (view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0)
    throw new Error('Split ZIP archives are not supported.');
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff)
    throw new Error('ZIP64 archives are not supported.');
  if (directoryOffset + directorySize > end) throw new Error('Not a readable ZIP archive.');
  const entries: ZipEntry[] = [];
  let position = directoryOffset;
  for (let index = 0; index < count; index++) {
    if (position + 46 > end || view.getUint32(position, true) !== CENTRAL_SIGNATURE)
      throw new Error('Not a readable ZIP archive.');
    const flags = view.getUint16(position + 8, true);
    const method = view.getUint16(position + 10, true);
    const checksum = view.getUint32(position + 16, true);
    const compressedSize = view.getUint32(position + 20, true);
    const size = view.getUint32(position + 24, true);
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    const localOffset = view.getUint32(position + 42, true);
    const nameBytes = bytes.subarray(position + 46, position + 46 + nameLength);
    // Bit 11 declares UTF-8 names; many tools write UTF-8 without it, so other non-UTF-8 names are read as Latin-1.
    let name: string;
    try {
      name = utf8.decode(nameBytes);
    } catch {
      name = flags & 0x0800 ? lenientUtf8.decode(nameBytes) : latin1.decode(nameBytes);
    }
    position += 46 + nameLength + extraLength + commentLength;
    entries.push({
      name,
      directory: name.endsWith('/'),
      size,
      read: async () => {
        if (flags & 0x0001) throw new Error('Encrypted ZIP entries are not supported.');
        if (method !== STORED && method !== DEFLATED)
          throw new Error(`Uses unsupported ZIP compression (method ${method}).`);
        if (
          localOffset + 30 > bytes.length ||
          view.getUint32(localOffset, true) !== LOCAL_SIGNATURE
        )
          throw new Error(CORRUPT_ENTRY);
        const start =
          localOffset +
          30 +
          view.getUint16(localOffset + 26, true) +
          view.getUint16(localOffset + 28, true);
        if (start + compressedSize > bytes.length) throw new Error(CORRUPT_ENTRY);
        const stored = bytes.subarray(start, start + compressedSize);
        const data = method === STORED ? stored.slice() : await inflate(stored, size);
        if (data.length !== size || crc32(data) !== checksum) throw new Error(CORRUPT_ENTRY);
        return data;
      }
    });
  }
  return entries;
}

/** Inflates raw DEFLATE data, refusing output beyond the declared size so a forged header cannot exhaust memory. */
async function inflate(
  compressed: Uint8Array<ArrayBuffer>,
  size: number
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
    .getReader();
  const output = new Uint8Array(size);
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.length > size) throw new Error(CORRUPT_ENTRY);
      output.set(value, length);
      length += value.length;
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    throw new Error(CORRUPT_ENTRY);
  }
  if (length !== size) throw new Error(CORRUPT_ENTRY);
  return output;
}
