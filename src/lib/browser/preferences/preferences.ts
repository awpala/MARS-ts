/** Deferred access to browser preference storage; acquiring storage may throw and never happens during module evaluation. */
export type PreferenceStorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;

/** Read and validate a JSON preference; missing, malformed, or inaccessible storage returns undefined. Schemas stay with callers. */
export function loadPreference<T>(
  key: string,
  validate: (value: unknown) => T | undefined,
  storage: PreferenceStorageAccess
): T | undefined {
  try {
    const raw = storage().getItem(key);
    return raw === null ? undefined : validate(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

/** Validate before writing a JSON preference; blocked/full storage leaves the caller's in-memory state usable. Source saves use their own error-reporting paths. */
export function savePreference<T>(
  key: string,
  value: T,
  validate: (value: unknown) => T | undefined,
  storage: PreferenceStorageAccess
): void {
  const validated = validate(value);
  if (!validated) return;
  try {
    storage().setItem(key, JSON.stringify(validated));
  } catch {
    /* Keep in-memory preferences when persistence is unavailable. */
  }
}
