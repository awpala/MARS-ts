import { whenPageActive } from './pageFocus.js';
import { writeZip } from './zip.js';

/** How long a handed-off download keeps its object URL; the browser may still be reading it after the click returns. */
const OBJECT_URL_LIFETIME_MS = 60_000;

/** Default filename of the Export All archive. */
export const EXPORT_ALL_FILENAME = 'mars-asm-src-files.zip';

/** A file chosen in the browser's save picker, ready to be written. */
export interface SaveTarget {
  /** Opens the chosen file for writing. */
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

/** The Chromium File System Access save picker, typed locally because it is not part of the standard DOM library. */
type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<SaveTarget>;

/** One source's text as a downloadable file body. */
export function sourceBlob(source: string): Blob {
  return new Blob([source], { type: 'text/plain' });
}

/** UTF-8 sources as one uncompressed ZIP; callers supply unique, flat filenames. */
export function sourceArchiveBlob(files: readonly { name: string; source: string }[]): Blob {
  const encoder = new TextEncoder();
  return writeZip(files.map((file) => ({ name: file.name, data: encoder.encode(file.source) })));
}

/**
 * Opens the browser's save picker where one exists (Chromium) and resolves with the chosen file, or `canceled` when the picker
 * reports cancellation. Resolves undefined when there is no picker or the browser refuses it (for example after user activation
 * has expired), so the caller falls back to `downloadBlob`. Call it synchronously from the user's action, before other awaits.
 */
export async function requestSaveTarget(
  name: string,
  blob: Blob,
  description: string
): Promise<SaveTarget | 'canceled' | undefined> {
  const picker = (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (!picker) return undefined;
  try {
    return await picker.call(window, {
      suggestedName: name,
      types: [{ description, accept: { [blob.type]: [name.slice(name.lastIndexOf('.'))] } }]
    });
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    return error.name === 'AbortError' ? 'canceled' : undefined;
  }
}

/** Writes a blob to a file chosen in the save picker. */
export async function writeSaveTarget(target: SaveTarget, blob: Blob): Promise<void> {
  const writable = await target.createWritable();
  await writable.write(blob);
  await writable.close();
}

/**
 * Clicks a temporary download link and resolves once the page is active again; a save prompt that has already taken focus is
 * waited out, and one that opens later is the caller's to guard. The browser does not report whether its prompt was confirmed
 * or canceled. The temporary link is removed at once; its object URL is released in the background after a minute, without
 * holding the caller.
 */
export async function downloadBlob(name: string, blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
  }
  await whenPageActive();
}
