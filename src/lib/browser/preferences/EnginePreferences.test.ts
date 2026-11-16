import { describe, expect, it } from 'vitest';
import { ENGINE_SETTINGS_STORAGE_PREFIX, browserEnginePreferences } from './EnginePreferences.js';

describe('engine preference persistence', () => {
  it('stores each setting under the versioned engine prefix', () => {
    const values = new Map<string, string>();
    const preferences = browserEnginePreferences(() => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      }
    }));
    expect(preferences.readPreference('DelayedBranching')).toBeNull();
    preferences.writePreference('DelayedBranching', 'true');
    expect(values.get(`${ENGINE_SETTINGS_STORAGE_PREFIX}DelayedBranching`)).toBe('true');
    expect(preferences.readPreference('DelayedBranching')).toBe('true');
  });
  it('falls back to session-only settings when storage is unavailable', () => {
    const preferences = browserEnginePreferences(() => {
      throw new Error('Storage is blocked');
    });
    expect(preferences.readPreference('DelayedBranching')).toBeNull();
    expect(() => preferences.writePreference('DelayedBranching', 'true')).not.toThrow();
  });
});
