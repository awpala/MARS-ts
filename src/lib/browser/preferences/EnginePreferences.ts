import type { SettingsHost } from '#lib/engine/Settings.js';

/** Storage key prefix for individual engine settings; the canonical Settings preference key follows it. */
export const ENGINE_SETTINGS_STORAGE_PREFIX = 'mars-ts:engine-settings:v1:';

type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;

/** Engine preference host over browser storage; blocked or full storage keeps settings usable for the current session. */
export function browserEnginePreferences(
  storage: StorageAccess = () => window.localStorage
): Required<Pick<SettingsHost, 'readPreference' | 'writePreference'>> {
  return {
    readPreference: (key) => {
      try {
        return storage().getItem(ENGINE_SETTINGS_STORAGE_PREFIX + key);
      } catch {
        return null;
      }
    },
    writePreference: (key, value) => {
      try {
        storage().setItem(ENGINE_SETTINGS_STORAGE_PREFIX + key, value);
      } catch {
        /* Session settings remain usable when persistence is blocked. */
      }
    }
  };
}
