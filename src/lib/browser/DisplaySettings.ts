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
  /** Whether register and memory values display in hexadecimal. */
  hexValues: boolean;
  /** Whether memory addresses display in hexadecimal. */
  hexAddresses: boolean;
  /** Legacy run-speed slider position, integer zero through forty. */
  speed: number;
}

type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;

function validate(value: unknown): DisplaySettings | undefined {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  if (
    typeof data.showLabels !== 'boolean' ||
    typeof data.showLines !== 'boolean' ||
    typeof data.hexValues !== 'boolean' ||
    typeof data.hexAddresses !== 'boolean' ||
    typeof data.speed !== 'number' ||
    !Number.isInteger(data.speed) ||
    data.speed < 0 ||
    data.speed > MAX_SPEED_POSITION
  )
    return;
  if (
    (data.showRegisters !== undefined && typeof data.showRegisters !== 'boolean') ||
    (data.clearAllOutputsOnGo !== undefined && typeof data.clearAllOutputsOnGo !== 'boolean') ||
    (data.autoSave !== undefined && typeof data.autoSave !== 'boolean') ||
    (data.ascii !== undefined && typeof data.ascii !== 'boolean') ||
    (data.showDataLabels !== undefined && typeof data.showDataLabels !== 'boolean') ||
    (data.showTextLabels !== undefined && typeof data.showTextLabels !== 'boolean') ||
    (data.labelSortState !== undefined &&
      (typeof data.labelSortState !== 'number' ||
        !Number.isInteger(data.labelSortState) ||
        data.labelSortState < 0 ||
        data.labelSortState > 7))
  )
    return;
  return {
    autoSave: data.autoSave ?? false,
    clearAllOutputsOnGo: data.clearAllOutputsOnGo ?? false,
    showRegisters: data.showRegisters ?? true,
    ascii: data.ascii ?? false,
    showLabels: data.showLabels,
    showDataLabels: data.showDataLabels ?? true,
    showTextLabels: data.showTextLabels ?? true,
    labelSortState: data.labelSortState ?? 0,
    showLines: data.showLines,
    hexValues: data.hexValues,
    hexAddresses: data.hexAddresses,
    speed: data.speed
  };
}

/** Reads a complete validated preference record; malformed data or unavailable storage uses the GUI defaults. */
export function loadDisplaySettings(
  storage: StorageAccess = () => window.localStorage
): DisplaySettings | undefined {
  try {
    const raw = storage().getItem(DISPLAY_SETTINGS_STORAGE_KEY);
    return raw === null ? undefined : validate(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

/** Stores only the working preference fields; blocked or full storage leaves in-memory settings usable. */
export function saveDisplaySettings(
  settings: DisplaySettings,
  storage: StorageAccess = () => window.localStorage
): void {
  const value = validate(settings);
  if (!value) return;
  try {
    storage().setItem(DISPLAY_SETTINGS_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* Keep in-memory preferences when persistence is unavailable. */
  }
}
