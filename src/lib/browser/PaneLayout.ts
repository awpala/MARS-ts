import { loadPreference, savePreference, type PreferenceStorageAccess } from './preferences.js';

/** Browser persistence key for the first version of the desktop pane dividers. */
export const PANE_LAYOUT_STORAGE_KEY = 'mars-ts:panes:v1';

/** Narrowest register width in CSS pixels that keeps its table usable. */
export const MIN_REGISTER_WIDTH = 260;

/** Shortest requested Data Segment height in CSS pixels. */
export const MIN_DATA_SEGMENT_HEIGHT = 60;

/** View-only pane preferences; they never belong to engine sessions. */
export interface PaneLayout {
  /** Desired register width in CSS pixels; viewport constraints are applied by the presenter. */
  registerWidth: number;
  /** Editor share of the left pane height, before minimum pane sizes are applied. */
  editorFraction: number;
  /** Requested Data Segment height in CSS pixels, or null for its natural height; absent in older records. */
  dataSegmentHeight: number | null;
}

function validate(value: unknown): PaneLayout | undefined {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  if (
    typeof data.registerWidth !== 'number' ||
    !Number.isFinite(data.registerWidth) ||
    typeof data.editorFraction !== 'number' ||
    !Number.isFinite(data.editorFraction)
  )
    return;
  const dataSegmentHeight = data.dataSegmentHeight;
  return {
    registerWidth: Math.max(MIN_REGISTER_WIDTH, Math.round(data.registerWidth)),
    editorFraction: Math.max(0, Math.min(1, data.editorFraction)),
    dataSegmentHeight:
      typeof dataSegmentHeight === 'number' && Number.isFinite(dataSegmentHeight)
        ? Math.max(MIN_DATA_SEGMENT_HEIGHT, Math.round(dataSegmentHeight))
        : null
  };
}

/** Reads validated layout preferences; unavailable storage or malformed data silently uses default layout. */
export function loadPaneLayout(
  storage: PreferenceStorageAccess = () => window.localStorage
): PaneLayout | undefined {
  return loadPreference(PANE_LAYOUT_STORAGE_KEY, validate, storage);
}

/** Persists view preferences after a resize gesture; blocked or full storage never interrupts editing. */
export function savePaneLayout(
  layout: PaneLayout,
  storage: PreferenceStorageAccess = () => window.localStorage
): void {
  savePreference(PANE_LAYOUT_STORAGE_KEY, layout, validate, storage);
}
