import { describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, saveTheme } from './ThemePreference.js';

describe('theme preference persistence', () => {
  it('stores the explicit appearance choice', () => {
    const values = new Map<string, string>();
    saveTheme('dark', () => ({
      setItem: (key: string, value: string) => {
        values.set(key, value);
      }
    }));
    expect(values.get(THEME_STORAGE_KEY)).toBe('dark');
  });
  it('tolerates blocked storage', () => {
    expect(() =>
      saveTheme('light', () => {
        throw new Error('Storage is blocked');
      })
    ).not.toThrow();
  });
});
