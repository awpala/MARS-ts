import { isSourceFilename, sourceBasename, sourceExtension } from '#lib/browser/SourceLibrary.js';
import type { SavedSource } from '#lib/browser/SourceLibrary.js';

/** Extension given to an exported source whose own name lacks a recognized assembly extension. */
const DEFAULT_EXPORT_EXTENSION = 'asm';

/**
 * Assign each source a unique, flat download filename. A recognized assembly extension (`.asm` or `.s`) is kept in lowercase so exported
 * files import back unchanged; other names receive `.asm`. Sources whose final path segment repeats are numbered from `-2` before the extension.
 */
export function exportFilenames(sources: readonly SavedSource[]): SavedSource[] {
  const used = new Set<string>();
  return sources.map(({ name, source }) => {
    const basename = sourceBasename(name);
    const extension = isSourceFilename(basename)
      ? sourceExtension(basename)
      : DEFAULT_EXPORT_EXTENSION;
    const stem = basename.replace(/\.[^.]+$/, '');
    let filename = `${stem}.${extension}`;
    for (let suffix = 2; used.has(filename); suffix++) filename = `${stem}-${suffix}.${extension}`;
    used.add(filename);
    return { name: filename, source };
  });
}
