/** Initiates a source download in this tab, then releases its temporary URL. Does not overwrite an opened native file. */
export function downloadSource(name: string, source: string): void {
  downloadBlob(name, new Blob([source], { type: 'text/plain;charset=utf-8' }));
}

function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}

const EXPORT_ALL_BLOB_FILENAME = 'mars-asm-src-files.zip';

/** Downloads UTF-8 sources as one uncompressed ZIP; callers supply unique, flat filenames and may override the default archive filename. */
export function downloadSourceArchive(
  files: readonly { name: string; source: string }[],
  filename: string = EXPORT_ALL_BLOB_FILENAME
): void {
  const encoder = new TextEncoder();
  const entries: BlobPart[] = [];
  const directory: BlobPart[] = [];
  let offset = 0;
  let directorySize = 0;
  if (files.length > 0xffff) throw new Error('Too many sources for a ZIP archive.');
  for (const file of files) {
    const name = encoder.encode(file.name);
    const source = encoder.encode(file.source);
    if (name.length > 0xffff || offset + 30 + name.length + source.length > 0xffffffff) {
      throw new Error('Sources exceed the ZIP archive size limit.');
    }
    let crc = 0xffffffff;
    for (const byte of source) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names; stored entries need no compression.
    local.setUint16(12, 0x0021, true); // January 1, 1980, the DOS date epoch.
    local.setUint32(14, crc, true);
    local.setUint32(18, source.length, true);
    local.setUint32(22, source.length, true);
    local.setUint16(26, name.length, true);
    entries.push(local.buffer, name, source);
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 0x0314, true); // Unix origin prevents DOS filename recoding by ZIP readers.
    new Uint8Array(central.buffer, 6, 26).set(new Uint8Array(local.buffer, 4, 26));
    central.setUint32(42, offset, true);
    directory.push(central.buffer, name);
    directorySize += 46 + name.length;
    offset += 30 + name.length + source.length;
  }
  if (offset + directorySize > 0xffffffff)
    throw new Error('Sources exceed the ZIP archive size limit.');
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  downloadBlob(
    filename,
    new Blob([...entries, ...directory, end.buffer], { type: 'application/zip' })
  );
}
