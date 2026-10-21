/** Storage key for the light/dark appearance choice; `src/app.html` reads the same literal before first paint. */
export const THEME_STORAGE_KEY = 'mars-ts:theme:v1';

/** Supported document appearance themes. */
export type Theme = 'light' | 'dark';

type StorageAccess = () => Pick<Storage, 'setItem'>;

/** Persist an explicit appearance choice; blocked or full storage keeps in-memory switching available. */
export function saveTheme(theme: Theme, storage: StorageAccess = () => window.localStorage): void {
  try {
    storage().setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Theme switching remains available when browser storage is blocked or full. */
  }
}
