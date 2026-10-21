import { readFileSync } from 'node:fs';

/**
 * Read a checked-in JSON fixture relative to this oracle directory.
 * The caller supplies its capture schema; this reader does not validate, normalize, or cache it.
 */
export function readOracleJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
}

/** Decode JSON-lines probe output, preserving each suite's existing trailing-whitespace handling. */
export function parseJsonRows<T>(stdout: string): T[] {
  return stdout
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line) as T);
}

/** Decode tab-separated probe output without trimming individual fields or changing row order. */
export function parseTabRows(stdout: string): string[][] {
  return stdout
    .trimEnd()
    .split('\n')
    .map((line) => line.split('\t'));
}
