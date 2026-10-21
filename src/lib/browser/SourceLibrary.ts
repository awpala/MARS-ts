/** JSON-array storage key for explicitly saved assembly sources. */
export const SOURCE_LIBRARY_STORAGE_KEY = 'mars-ts:sources:v1';

/** JSON-array storage key for open working buffers, including unsaved source text. */
export const SOURCE_WORKSPACE_STORAGE_KEY = 'mars-ts:workspace:v1';

/** One named source in the browser's persistent library, independent of editor history. */
export interface SavedSource {
  /** Unique relative virtual filename, also used for include resolution. */
  name: string;
  /** Exact saved assembly text. */
  source: string;
}

/** Recoverable working buffer; savedSource retains the baseline for Save/Discard decisions. */
export interface SourceDraft extends SavedSource {
  /** Exact text at the last successful explicit save or open. */
  savedSource: string;
  /** Whether this buffer has never been explicitly saved. */
  isNew: boolean;
  /** Whether this buffer was the selected editor tab. */
  selected: boolean;
}

/** Storage acquisition is deferred until a user action or browser mount, never SSR. */
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;

/** Canonicalizes a relative virtual filename; rejects empty names and escaping paths. */
export function sourceName(value: string): string {
  const name = value.trim().replaceAll('\\', '/');
  if (
    !name ||
    name.startsWith('/') ||
    name.includes(':') ||
    [...name].some((character) => character.charCodeAt(0) < 32)
  )
    throw new Error('Enter a relative source filename.');
  const parts: string[] = [];
  for (const part of name.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) throw new Error('Source filenames must stay within the library.');
      parts.pop();
    } else parts.push(part);
  }
  if (!parts.length || name.endsWith('/')) throw new Error('Enter a source filename.');
  return parts.join('/');
}

/** Returns the final path segment of a virtual source filename, accepting either path separator. */
export function sourceBasename(name: string): string {
  return name.split(/[/\\]/).at(-1) ?? name;
}

/** Owns persistent source reads/writes; failed writes never change editor saved snapshots. */
export class SourceLibrary {
  /** Accepts an injectable browser storage provider for isolation and failure testing. */
  constructor(private readonly storage: StorageAccess = () => window.localStorage) {}

  /** Reads fresh records, rejecting corrupt data rather than silently replacing user sources. */
  read(): SavedSource[] {
    const raw = this.storage().getItem(SOURCE_LIBRARY_STORAGE_KEY);
    if (raw === null) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('The saved source library is not a JSON array.');
    const names = new Set<string>();
    return data.map((entry: unknown) => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        !('name' in entry) ||
        !('source' in entry) ||
        typeof entry.name !== 'string' ||
        typeof entry.source !== 'string'
      )
        throw new Error('The saved source library contains an invalid file.');
      const name = sourceName(entry.name);
      if (names.has(name))
        throw new Error(`The saved source library contains duplicate name "${name}".`);
      names.add(name);
      return { name, source: entry.source };
    });
  }

  /** Atomically writes one source into the latest collection; unrelated saved files are retained. */
  save(name: string, source: string): SavedSource[] {
    return this.saveMany([{ name, source }]);
  }

  /** Commits a renamed source in one write; failure preserves both prior filenames and contents. */
  rename(oldName: string, name: string, source: string): SavedSource[] {
    oldName = sourceName(oldName);
    name = sourceName(name);
    const records = this.read().filter((file) => file.name !== oldName && file.name !== name);
    records.push({ name, source });
    this.storage().setItem(SOURCE_LIBRARY_STORAGE_KEY, JSON.stringify(records));
    return records;
  }

  /** Removes only confirmed library names, atomically; the presenter handles matching open buffers. */
  delete(names: readonly string[]): SavedSource[] {
    const selected = new Set(names.map(sourceName));
    const records = this.read().filter((file) => !selected.has(file.name));
    this.storage().setItem(SOURCE_LIBRARY_STORAGE_KEY, JSON.stringify(records));
    return records;
  }

  /** Writes an import batch in one storage operation so quota failures cannot partially import. */
  saveMany(sources: readonly SavedSource[]): SavedSource[] {
    const records = this.read();
    const names = new Set<string>();
    for (const entry of sources) {
      const name = sourceName(entry.name);
      if (names.has(name)) throw new Error(`Multiple imported files are named "${name}".`);
      names.add(name);
      const index = records.findIndex((record) => record.name === name);
      if (index < 0) records.push({ name, source: entry.source });
      else records[index] = { name, source: entry.source };
    }
    this.storage().setItem(SOURCE_LIBRARY_STORAGE_KEY, JSON.stringify(records));
    return records;
  }

  /** Loads every open buffer's text and saved baseline; invalid backups are left untouched. */
  readWorkspace(): SourceDraft[] {
    const raw = this.storage().getItem(SOURCE_WORKSPACE_STORAGE_KEY);
    if (raw === null) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('The source workspace is not a JSON array.');
    const names = new Set<string>();
    return data.map((entry: unknown) => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        !('name' in entry) ||
        !('source' in entry) ||
        !('savedSource' in entry) ||
        !('isNew' in entry) ||
        !('selected' in entry) ||
        typeof entry.name !== 'string' ||
        typeof entry.source !== 'string' ||
        typeof entry.savedSource !== 'string' ||
        typeof entry.isNew !== 'boolean' ||
        typeof entry.selected !== 'boolean'
      )
        throw new Error('The source workspace contains an invalid buffer.');
      const name = sourceName(entry.name);
      if (names.has(name))
        throw new Error(`The source workspace contains duplicate name "${name}".`);
      names.add(name);
      return {
        name,
        source: entry.source,
        savedSource: entry.savedSource,
        isNew: entry.isNew,
        selected: entry.selected
      };
    });
  }

  /** Synchronously backs up all current text after edits, without changing explicit save baselines. */
  saveWorkspace(drafts: readonly SourceDraft[]): void {
    this.storage().setItem(SOURCE_WORKSPACE_STORAGE_KEY, JSON.stringify(drafts));
  }
}
