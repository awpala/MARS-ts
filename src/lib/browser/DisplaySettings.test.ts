import { describe, expect, it } from 'vitest';
import {
  DISPLAY_SETTINGS_STORAGE_KEY,
  loadDisplaySettings,
  saveDisplaySettings
} from './DisplaySettings.js';

const settings = {
  autoSave: false,
  clearAllOutputsOnGo: true,
  promptClearBreakpoints: true,
  showRegisters: false,
  ascii: false,
  showLabels: true,
  showDataLabels: false,
  showTextLabels: true,
  labelSortState: 5,
  showLines: false,
  hexValues: false,
  hexAddresses: false,
  speed: 12
};

describe('working display preference persistence', () => {
  it('round-trips false values and retains only the supported fields', () => {
    const values = new Map<string, string>();
    const storage = () => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      }
    });
    saveDisplaySettings({ ...settings, ...{ source: 'not a preference' } }, storage);
    expect(loadDisplaySettings(storage)).toEqual(settings);
    expect(JSON.parse(values.get(DISPLAY_SETTINGS_STORAGE_KEY)!)).toEqual(settings);
  });
  it('rejects partial, mistyped, and invalid slider data without coercing values', () => {
    for (const value of [
      null,
      {},
      { ...settings, showLines: 'false' },
      { ...settings, autoSave: 'true' },
      { ...settings, clearAllOutputsOnGo: 'true' },
      { ...settings, promptClearBreakpoints: 'true' },
      { ...settings, showRegisters: 'false' },
      { ...settings, ascii: 'true' },
      { ...settings, speed: -1 },
      { ...settings, speed: 41 },
      { ...settings, speed: 1.5 },
      { ...settings, speed: '12' },
      { ...settings, showDataLabels: 'false' },
      { ...settings, labelSortState: 8 }
    ]) {
      expect(
        loadDisplaySettings(() => ({ getItem: () => JSON.stringify(value), setItem: () => {} }))
      ).toBeUndefined();
    }
    expect(
      loadDisplaySettings(() => ({ getItem: () => 'broken JSON', setItem: () => {} }))
    ).toBeUndefined();
  });
  it('preserves existing display preferences when adding label filter and sort defaults', () => {
    const { showDataLabels, showTextLabels, labelSortState, ...older } = settings;
    void showDataLabels;
    void showTextLabels;
    void labelSortState;
    expect(
      loadDisplaySettings(() => ({ getItem: () => JSON.stringify(older), setItem: () => {} }))
    ).toEqual({ ...older, showDataLabels: true, showTextLabels: true, labelSortState: 0 });
  });
  it('defaults the register pane to shown for pre-toggle preferences', () => {
    const { showRegisters, ...older } = settings;
    void showRegisters;
    expect(
      loadDisplaySettings(() => ({ getItem: () => JSON.stringify(older), setItem: () => {} }))
    ).toEqual({ ...older, showRegisters: true });
  });
  it('defaults console clearing to unselected for older preferences', () => {
    const { clearAllOutputsOnGo, ...older } = settings;
    void clearAllOutputsOnGo;
    expect(
      loadDisplaySettings(() => ({ getItem: () => JSON.stringify(older), setItem: () => {} }))
    ).toEqual({ ...older, clearAllOutputsOnGo: false });
  });
  it('defaults the Clear all breakpoints prompt to unselected for older preferences', () => {
    const { promptClearBreakpoints, ...older } = settings;
    void promptClearBreakpoints;
    expect(
      loadDisplaySettings(() => ({ getItem: () => JSON.stringify(older), setItem: () => {} }))
    ).toEqual({ ...older, promptClearBreakpoints: false });
  });
  it('tolerates denied storage access and quota failures', () => {
    const denied = () => {
      throw new Error('Storage denied');
    };
    expect(loadDisplaySettings(denied)).toBeUndefined();
    expect(() => saveDisplaySettings(settings, denied)).not.toThrow();
    expect(() =>
      saveDisplaySettings(settings, () => ({
        getItem: () => null,
        setItem: () => {
          throw new Error('Quota exceeded');
        }
      }))
    ).not.toThrow();
  });
});
