import { loadPreference, savePreference, type PreferenceStorageAccess } from './preferences.js';

/** Browser preference key for the working editor/display controls. */
export const DISPLAY_SETTINGS_STORAGE_KEY = 'mars-ts:display-settings:v1';

/** Largest legacy run-speed slider position, the stored value for maximum speed. */
export const MAX_SPEED_POSITION = 40;

/** Persistent view preferences, independent of source documents and machine state. */
export interface DisplaySettings {
  /** Commit all changed open sources automatically; defaults to false for older records. */
  autoSave: boolean;
  /** Clear both console buffers when Go starts a fresh program run; defaults to false for older records. */
  clearAllOutputsOnGo: boolean;
  /** Confirm Clear all breakpoints in a dialog; defaults to false for older records. */
  promptClearBreakpoints: boolean;
  /** Render Data Segment bytes as ASCII; defaults to false for older records. */
  ascii: boolean;
  /** Whether the registers sidebar is shown; defaults to true for older records. */
  showRegisters: boolean;
  /** Whether Execute displays the Labels pane. */
  showLabels: boolean;
  /** Whether the Labels panel includes data symbols; defaults to true for older records. */
  showDataLabels: boolean;
  /** Whether the Labels panel includes text symbols; defaults to true for older records. */
  showTextLabels: boolean;
  /** LabelsWindow's eight-state column/direction selection, zero through seven. */
  labelSortState: number;
  /** Whether the editor displays line numbers. */
  showLines: boolean;
  /** Whether the editor highlights the caret line; defaults to true for older records, as in Java MARS. */
  highlightCurrentLine: boolean;
  /** Whether register and memory values display in hexadecimal. */
  hexValues: boolean;
  /** Whether memory addresses display in hexadecimal. */
  hexAddresses: boolean;
  /** Legacy run-speed slider position, integer zero through forty. */
  speed: number;
}

type PreferenceField<T> = { default: T; required?: true } & (T extends number
  ? { maximum: number }
  : object);

// The original five fields remain required; later additions default when older records omit them.
const fields = {
  autoSave: { default: false },
  clearAllOutputsOnGo: { default: false },
  promptClearBreakpoints: { default: false },
  ascii: { default: false },
  showRegisters: { default: true },
  showLabels: { default: true, required: true },
  showDataLabels: { default: true },
  showTextLabels: { default: true },
  labelSortState: { default: 0, maximum: 7 },
  showLines: { default: true, required: true },
  highlightCurrentLine: { default: true },
  hexValues: { default: true, required: true },
  hexAddresses: { default: true, required: true },
  speed: { default: MAX_SPEED_POSITION, required: true, maximum: MAX_SPEED_POSITION }
} satisfies { [Key in keyof DisplaySettings]: PreferenceField<DisplaySettings[Key]> };

/** Shared GUI defaults and persisted field vocabulary, derived from the adapter's validation schema. */
export const DEFAULT_DISPLAY_SETTINGS: Readonly<DisplaySettings> = Object.freeze(
  Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [key, field.default])
  ) as unknown as DisplaySettings
);

function validate(value: unknown): DisplaySettings | undefined {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  const settings = { ...DEFAULT_DISPLAY_SETTINGS };
  for (const key of Object.keys(fields) as (keyof DisplaySettings)[]) {
    const field = fields[key];
    const choice = data[key];
    if (choice === undefined) {
      if ('required' in field) return;
      continue;
    }
    if (typeof choice !== typeof field.default) return;
    if (
      'maximum' in field &&
      (typeof choice !== 'number' ||
        !Number.isInteger(choice) ||
        choice < 0 ||
        choice > field.maximum)
    )
      return;
    Object.assign(settings, { [key]: choice });
  }
  return settings;
}

/** Reads a complete validated preference record; missing, malformed, or unavailable storage returns undefined so the caller keeps its GUI defaults. */
export function loadDisplaySettings(
  storage: PreferenceStorageAccess = () => window.localStorage
): DisplaySettings | undefined {
  return loadPreference(DISPLAY_SETTINGS_STORAGE_KEY, validate, storage);
}

/** Stores only the working preference fields; blocked or full storage leaves in-memory settings usable. */
export function saveDisplaySettings(
  settings: DisplaySettings,
  storage: PreferenceStorageAccess = () => window.localStorage
): void {
  savePreference(DISPLAY_SETTINGS_STORAGE_KEY, settings, validate, storage);
}
