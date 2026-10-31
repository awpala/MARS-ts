import {
  isSourceFilename,
  SOURCE_EXTENSION_LABEL,
  SOURCE_FILE_ACCEPT,
  sourceExtension,
  sourceName,
  type SavedSource
} from './SourceLibrary.js';
import { readZip } from './zip.js';
import { errorMessage } from './errorMessage.js';

/** The import picker's `accept` value: the assembly extensions plus ZIP archives. */
export const IMPORT_FILE_ACCEPT = `${SOURCE_FILE_ACCEPT},.zip`;

/** Largest source, selected directly or extracted from an archive, that Import reads. */
export const IMPORT_SOURCE_LIMIT = 16 * 1024 * 1024;

const TOO_LARGE = `Larger than the ${IMPORT_SOURCE_LIMIT / 1024 / 1024} MiB import limit.`;

/** A source ready to commit, with the archive it came from when it was not selected directly. */
export interface ImportedSource extends SavedSource {
  /** Selected ZIP archive's filename, or undefined for a directly selected source file. */
  archive?: string;
}

/** A selected file or archive entry that Import will not commit, with the reason shown to the user. */
export interface SkippedImport {
  /** Selected filename, or the entry path inside its archive. */
  name: string;
  /** Selected ZIP archive's filename when the skipped item is one of its entries. */
  archive?: string;
  /** Readable, sentence-form reason. */
  reason: string;
}

/** Everything a selection would import, in selection and archive order, and everything it skips. */
export interface SourceImportPlan {
  /** Valid sources with unique virtual names. */
  sources: ImportedSource[];
  /** Invalid files and entries, never committed. */
  skipped: SkippedImport[];
}

/** Archive bookkeeping that is neither a user's source nor an attempted import: directories and macOS resource forks. */
function isArchiveMetadata(path: string): boolean {
  return path.endsWith('/') || path.startsWith('__MACOSX/') || path.includes('/__MACOSX/');
}

/**
 * Reads a picker selection into an import plan. Directly selected `.asm` and `.s` files keep their filename; ZIP archives
 * contribute each assembly entry under its normalized path inside the archive, so relative includes keep resolving. Every
 * other file or entry, unreadable data, an invalid path, and a name already taken by an earlier item in the selection is
 * skipped with a reason; nothing here touches the library.
 */
export async function readSourceImport(files: readonly File[]): Promise<SourceImportPlan> {
  const plan: SourceImportPlan = { sources: [], skipped: [] };
  const names = new Set<string>();
  const decoder = new TextDecoder();
  const skip = (name: string, reason: string, archive?: string) => {
    plan.skipped.push({ name, archive, reason });
  };
  const add = async (path: string, read: () => Promise<string>, archive?: string) => {
    let name: string;
    try {
      name = sourceName(path);
    } catch (error) {
      return skip(path, errorMessage(error), archive);
    }
    if (names.has(name)) return skip(path, 'Another selected source has the same name.', archive);
    try {
      plan.sources.push({ name, source: await read(), archive });
      names.add(name);
    } catch (error) {
      skip(path, errorMessage(error), archive);
    }
  };
  for (const file of files) {
    if (sourceExtension(file.name) === 'zip') {
      let entries;
      try {
        entries = readZip(new Uint8Array(await file.arrayBuffer()));
      } catch (error) {
        skip(file.name, errorMessage(error));
        continue;
      }
      const sources = entries.filter((entry) => !isArchiveMetadata(entry.name));
      if (!sources.length) {
        skip(file.name, 'The archive contains no files.');
        continue;
      }
      for (const entry of sources) {
        if (!isSourceFilename(entry.name)) {
          skip(entry.name, `Not an assembly source (${SOURCE_EXTENSION_LABEL}).`, file.name);
          continue;
        }
        if (entry.size > IMPORT_SOURCE_LIMIT) {
          skip(entry.name, TOO_LARGE, file.name);
          continue;
        }
        await add(entry.name, async () => decoder.decode(await entry.read()), file.name);
      }
    } else if (!isSourceFilename(file.name)) {
      skip(file.name, `Not an assembly source (${SOURCE_EXTENSION_LABEL}) or ZIP archive.`);
    } else if (file.size > IMPORT_SOURCE_LIMIT) {
      skip(file.name, TOO_LARGE);
    } else {
      await add(file.name, () => file.text());
    }
  }
  return plan;
}
