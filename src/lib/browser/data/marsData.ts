import schemaDocument from '#schemas/mars-ts-data.v1.schema.json';
import { errorMessage } from '../errorMessage.js';
import {
  DISPLAY_SETTINGS_STORAGE_KEY,
  loadDisplaySettings,
  type DisplaySettings
} from '../preferences/DisplaySettings.js';
import { ENGINE_SETTINGS_STORAGE_PREFIX } from '../preferences/EnginePreferences.js';
import {
  loadPaneLayout,
  PANE_LAYOUT_STORAGE_KEY,
  type PaneLayout
} from '../preferences/PaneLayout.js';
import { THEME_STORAGE_KEY, type Theme } from '../preferences/ThemePreference.js';
import {
  DESKTOP_SESSION_STORAGE_KEY,
  isDesktopSession,
  type DesktopSession
} from '../session/DesktopSession.js';
import {
  SOURCE_LIBRARY_STORAGE_KEY,
  SOURCE_WORKSPACE_STORAGE_KEY,
  SourceLibrary,
  type SavedSource,
  type SourceDraft
} from '../sources/SourceLibrary.js';
import { validateJsonSchema, type JsonSchema } from './jsonSchema.js';

/** The checked-in payload definition under `schemas/`, evaluated as written rather than restated in code. */
export const MARS_DATA_SCHEMA: JsonSchema = schemaDocument as JsonSchema;

/** Default filename of an Export MARS download. */
export const MARS_DATA_FILENAME = 'mars-ts-data.json';
/** Fixed `format` value identifying a MARS-ts data payload. */
export const MARS_DATA_FORMAT = 'mars-ts-data';
/** Envelope version this application writes and reads. */
export const MARS_DATA_VERSION = 1;
/** The `accept` value of the Import MARS file picker. */
export const MARS_DATA_ACCEPT = '.json,application/json';
/** Largest file Import MARS reads; browser storage holds far less, so a larger file cannot be a usable export. */
export const MARS_DATA_MAX_BYTES = 32 * 1024 * 1024;
/** Most problems reported for one rejected file. */
const ISSUE_LIMIT = 20;

/** Mirror of the application's localStorage keys: parsed JSON records, and unchanged text for the theme and engine settings. */
export type MarsDataStorage = {
  /** Explicitly saved assembly sources. */
  [SOURCE_LIBRARY_STORAGE_KEY]?: SavedSource[];
  /** Open working buffers, including unsaved text. */
  [SOURCE_WORKSPACE_STORAGE_KEY]?: SourceDraft[];
  /** Working editor and display preferences; older records omit later additions. */
  [DISPLAY_SETTINGS_STORAGE_KEY]?: Partial<DisplaySettings>;
  /** Desktop divider positions. */
  [PANE_LAYOUT_STORAGE_KEY]?: Partial<PaneLayout>;
  /** Appearance choice. */
  [THEME_STORAGE_KEY]?: Theme;
  /** Desktop recovery record. */
  [DESKTOP_SESSION_STORAGE_KEY]?: DesktopSession;
} & {
  /** One engine setting's stored text, keyed by its full storage key. */
  [key: `${typeof ENGINE_SETTINGS_STORAGE_PREFIX}${string}`]: string | undefined;
};

/** Portable copy of one browser's MARS-ts application data, as defined by the checked-in schema. */
export interface MarsData {
  /** Identifier of the schema the payload conforms to; informational. */
  $schema?: string;
  /** Fixed payload identity. */
  format: typeof MARS_DATA_FORMAT;
  /** Envelope version. */
  version: typeof MARS_DATA_VERSION;
  /** UTC export time in ISO 8601 form; informational. */
  exportedAt?: string;
  /** Mirrored storage records; an absent key was not stored. */
  storage: MarsDataStorage;
}

/** What a payload contains, for the import confirmation. */
export interface MarsDataSummary {
  /** Sources in the saved library. */
  savedSources: number;
  /** Open working buffers. */
  openBuffers: number;
  /** Open working buffers that are new or differ from their saved text. */
  unsavedBuffers: number;
  /** Stored preference records: display settings, pane layout, theme, and individual engine settings. */
  settings: number;
  /** Whether a desktop recovery record is included. */
  session: boolean;
  /** Lead source of the recovered loaded program, or null when the session has none. */
  loadedProgram: string | null;
  /** Export time recorded in the payload, or null when absent. */
  exportedAt: string | null;
}

/** Outcome of reading an Import MARS selection: a conforming payload with its summary, or the reasons the file was rejected. */
export type MarsDataReading = {
  /** Name of the selected file, for display. */
  filename: string;
} & (
  | {
      /** Payload that passed every check and may replace the stored data. */
      data: MarsData;
      /** Contents of that payload. */
      summary: MarsDataSummary;
      /** Absent for a conforming payload. */
      issues?: never;
    }
  | {
      /** Absent for a rejected file. */
      data?: never;
      /** Absent for a rejected file. */
      summary?: never;
      /** Problems found, in document order and at most twenty. */
      issues: string[];
    }
);

/** Storage operations the capture and replacement need; acquisition is deferred so it never happens during module evaluation or SSR. */
export type MarsDataStorageAccess = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const storageSchema = MARS_DATA_SCHEMA.properties!.storage;

/** Every storage key the payload mirrors, in schema order; the schema is the single registry of these keys. */
export const MARS_DATA_STORAGE_KEYS: readonly string[] = Object.keys(storageSchema.properties!);

/** Whether a mirrored key holds its stored text unchanged; every other key holds JSON, parsed in the payload. */
function isTextKey(key: string): boolean {
  const record = storageSchema.properties![key];
  const resolved = record.$ref
    ? MARS_DATA_SCHEMA.$defs![record.$ref.slice('#/$defs/'.length)]
    : record;
  return resolved.type === 'string';
}

function encode(key: string, value: unknown): string {
  return isTextKey(key) ? (value as string) : JSON.stringify(value);
}

/**
 * Copy every mirrored key present in storage into a payload stamped with the export time. Storage is only read. Throws when a
 * stored record is not valid JSON; conformance of the result is the caller's check through `validateMarsData`.
 */
export function captureMarsData(storage: MarsDataStorageAccess, now = new Date()): MarsData {
  const store = storage();
  const records: Record<string, unknown> = {};
  for (const key of MARS_DATA_STORAGE_KEYS) {
    const raw = store.getItem(key);
    if (raw === null) continue;
    if (isTextKey(key)) records[key] = raw;
    else
      try {
        records[key] = JSON.parse(raw);
      } catch {
        throw new Error(`The stored ${key} record is not valid JSON.`);
      }
  }
  return {
    $schema: MARS_DATA_SCHEMA.$id,
    format: MARS_DATA_FORMAT,
    version: MARS_DATA_VERSION,
    exportedAt: now.toISOString(),
    storage: records as MarsDataStorage
  };
}

/** A payload as a downloadable JSON file body. */
export function marsDataBlob(data: MarsData): Blob {
  return new Blob([JSON.stringify(data), '\n'], { type: 'application/json' });
}

/** Run each mirrored record through the reader that will load it, so a payload the schema accepts is also one the application can use. */
function readerIssues(records: MarsDataStorage): string[] {
  const memory = () => ({
    getItem: (key: string) => {
      const value = (records as Record<string, unknown>)[key];
      return value === undefined ? null : encode(key, value);
    },
    setItem() {}
  });
  const issues: string[] = [];
  const check = (key: keyof MarsDataStorage, load: () => unknown): void => {
    if (records[key] === undefined) return;
    try {
      if (load() === undefined) issues.push(`/storage/${key} is not a record MARS can load.`);
    } catch (error) {
      issues.push(`/storage/${key}: ${errorMessage(error)}`);
    }
  };
  check(SOURCE_LIBRARY_STORAGE_KEY, () => new SourceLibrary(memory).read());
  check(SOURCE_WORKSPACE_STORAGE_KEY, () => new SourceLibrary(memory).readWorkspace());
  check(DISPLAY_SETTINGS_STORAGE_KEY, () => loadDisplaySettings(memory));
  check(PANE_LAYOUT_STORAGE_KEY, () => loadPaneLayout(memory));
  check(DESKTOP_SESSION_STORAGE_KEY, () =>
    isDesktopSession(records[DESKTOP_SESSION_STORAGE_KEY]) ? true : undefined
  );
  return issues;
}

/**
 * Check a parsed value against the checked-in schema, then against the readers that own each record, which enforce what the
 * schema cannot express: valid unique source names and the recovery record's internal references. Returns at most twenty
 * problems; an empty list means the value is a payload this application can import.
 */
export function validateMarsData(value: unknown): string[] {
  const issues = validateJsonSchema(MARS_DATA_SCHEMA, value, ISSUE_LIMIT).map(
    ({ path, message }) => `${path || 'The document'} ${message}.`
  );
  return issues.length ? issues : readerIssues((value as MarsData).storage);
}

/** Count what a conforming payload contains. */
export function summarizeMarsData(data: MarsData): MarsDataSummary {
  const records = data.storage;
  const drafts = records[SOURCE_WORKSPACE_STORAGE_KEY] ?? [];
  const preferenceKeys: string[] = [
    DISPLAY_SETTINGS_STORAGE_KEY,
    PANE_LAYOUT_STORAGE_KEY,
    THEME_STORAGE_KEY
  ];
  const session = records[DESKTOP_SESSION_STORAGE_KEY];
  return {
    savedSources: records[SOURCE_LIBRARY_STORAGE_KEY]?.length ?? 0,
    openBuffers: drafts.length,
    unsavedBuffers: drafts.filter((draft) => draft.isNew || draft.source !== draft.savedSource)
      .length,
    settings: Object.keys(records).filter(
      (key) => preferenceKeys.includes(key) || key.startsWith(ENGINE_SETTINGS_STORAGE_PREFIX)
    ).length,
    session: session !== undefined,
    loadedProgram: session?.execution?.machine.filename ?? null,
    exportedAt: data.exportedAt ?? null
  };
}

/** Parse and validate the text of a selected file. Never throws: malformed JSON and nonconforming payloads are returned as issues. */
export function readMarsData(filename: string, text: string): MarsDataReading {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { filename, issues: [`The file is not valid JSON: ${errorMessage(error)}`] };
  }
  const issues = validateMarsData(value);
  if (issues.length) return { filename, issues };
  const data = value as MarsData;
  return { filename, data, summary: summarizeMarsData(data) };
}

/** Read a picker selection as a payload, rejecting an oversized or unreadable file as an issue rather than an exception. */
export async function readMarsDataFile(file: File): Promise<MarsDataReading> {
  if (file.size > MARS_DATA_MAX_BYTES)
    return {
      filename: file.name,
      issues: [`The file is larger than ${MARS_DATA_MAX_BYTES / 1024 / 1024} MiB.`]
    };
  try {
    return readMarsData(file.name, await file.text());
  } catch (error) {
    return { filename: file.name, issues: [`The file could not be read: ${errorMessage(error)}`] };
  }
}

/**
 * Replace every mirrored storage key with a validated payload: keys the payload omits are removed, and keys outside the
 * schema are left alone. If any write fails, such as on a full quota, the previous values of all mirrored keys are written
 * back before the failure is rethrown. The caller stops its own storage writers first and reloads the application afterwards.
 */
export function applyMarsData(data: MarsData, storage: MarsDataStorageAccess): void {
  const store = storage();
  const previous = MARS_DATA_STORAGE_KEYS.map((key) => [key, store.getItem(key)] as const);
  try {
    for (const key of MARS_DATA_STORAGE_KEYS) store.removeItem(key);
    for (const key of MARS_DATA_STORAGE_KEYS) {
      const value = (data.storage as Record<string, unknown>)[key];
      if (value !== undefined) store.setItem(key, encode(key, value));
    }
  } catch (error) {
    for (const [key] of previous)
      try {
        store.removeItem(key);
      } catch {
        /* Continue restoring the remaining keys. */
      }
    for (const [key, value] of previous)
      try {
        if (value !== null) store.setItem(key, value);
      } catch {
        /* Continue restoring the remaining keys. */
      }
    throw error;
  }
}
