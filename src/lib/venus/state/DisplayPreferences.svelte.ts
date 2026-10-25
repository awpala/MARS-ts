import { loadPaneLayout, MIN_REGISTER_WIDTH, savePaneLayout } from '#lib/browser/PaneLayout.js';
import {
  loadDisplaySettings,
  MAX_SPEED_POSITION,
  saveDisplaySettings,
  type DisplaySettings
} from '#lib/browser/DisplaySettings.js';
import type { MainView, MemorySegment, RegisterBank } from '#lib/browser/DesktopSession.js';
import { clamp } from '../utils/geometry/clamp.js';
import {
  DEFAULT_REGISTER_WIDTH,
  EDITOR_MIN_HEIGHT,
  EDITOR_RESERVED_HEIGHT,
  REGISTER_RESERVED_SOURCE_WIDTH
} from '../utils/geometry/layout.js';

/** Persisted display fields other than Auto Save, which the source workspace owns. */
const persistedKeys = [
  'clearAllOutputsOnGo',
  'promptClearBreakpoints',
  'showRegisters',
  'ascii',
  'showLabels',
  'showDataLabels',
  'showTextLabels',
  'labelSortState',
  'showLines',
  'hexValues',
  'hexAddresses',
  'speed'
] as const satisfies readonly (keyof DisplaySettings)[];

function pick<T, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((key) => [key, source[key]])) as Pick<T, K>;
}

/** Per-desktop display selection, preferences, and measured pane geometry. Storage is accessed only by explicit browser lifecycle calls. */
export class DisplayPreferences {
  /** Selected main pane; Edit by default. */
  view = $state<MainView>('Edit');
  /** Browser-only preference to clear both consoles when Go starts a fresh program run; unselected by default. */
  clearAllOutputsOnGo = $state(false);
  /** Browser-only preference to confirm Clear all breakpoints in a dialog; unselected by default, clearing immediately as in MARS 4.5. */
  promptClearBreakpoints = $state(false);
  /** Selected Data Segment range, recovered with the desktop session. */
  dataSegment = $state<MemorySegment>('data');
  /** Relative aligned Data Segment page offset, recovered with the desktop session. */
  dataPageOffset = $state(0);
  /** Whether the register banks pane and its divider are visible; shown by default. */
  showRegisters = $state(true);
  /** Selected register bank; Registers by default. */
  registerTab = $state<RegisterBank>('Registers');
  /** Whether Execute shows the Labels pane; shown by default. */
  showLabels = $state(true);
  /** Include data labels in the Labels pane. */
  showDataLabels = $state(true);
  /** Include text labels in the Labels pane. */
  showTextLabels = $state(true);
  /** Legacy eight-state label sorting selection. */
  labelSortState = $state(0);
  /** Whether the source editor shows line numbers. */
  showLines = $state(true);
  /** Whether memory values display as ASCII. */
  ascii = $state(false);
  /** Whether register and memory values display in hexadecimal. */
  hexValues = $state(true);
  /** Whether addresses display in hexadecimal. */
  hexAddresses = $state(true);
  /** Legacy run-speed slider position from zero through forty. */
  speed = $state(MAX_SPEED_POSITION);
  /** Measured available width supplied by the workspace element. */
  workspaceWidth = $state(1000);
  /** Requested register banks pane width in pixels. */
  registerWidth = $state(DEFAULT_REGISTER_WIDTH);
  /** Measured height of the left pane container. */
  leftPaneHeight = $state(700);
  /** Requested Data Segment height in pixels; null keeps its natural height. */
  dataSegmentHeight = $state<number | null>(null);
  /** Requested editor fraction of the left pane height. */
  editorFraction = $state(0.75);
  /** Largest editor height retaining usable messages. */
  maxEditorHeight = $derived(
    Math.max(EDITOR_MIN_HEIGHT, this.leftPaneHeight - EDITOR_RESERVED_HEIGHT)
  );
  /** Clamped editor height derived from its container and saved fraction. */
  displayedEditorHeight = $derived(
    clamp(
      Math.round(this.leftPaneHeight * this.editorFraction),
      EDITOR_MIN_HEIGHT,
      this.maxEditorHeight
    )
  );
  /** Largest register width retaining a usable source pane. */
  maxRegisterWidth = $derived(
    Math.max(MIN_REGISTER_WIDTH, this.workspaceWidth - REGISTER_RESERVED_SOURCE_WIDTH)
  );
  /** Register width clamped to current geometry. */
  displayedRegisterWidth = $derived(Math.min(this.registerWidth, this.maxRegisterWidth));
  /** Restore browser preferences and return the saved Auto Save choice to its workspace owner. */
  restore(): boolean {
    const layout = loadPaneLayout();
    if (layout) {
      this.registerWidth = layout.registerWidth;
      this.editorFraction = layout.editorFraction;
      this.dataSegmentHeight = layout.dataSegmentHeight;
    }
    const settings = loadDisplaySettings();
    if (!settings) return false;
    Object.assign(this, pick(settings, persistedKeys));
    return settings.autoSave;
  }
  /** Persist the display record, including the workspace owner's Auto Save choice. */
  persist(autoSave: boolean): void {
    saveDisplaySettings({ autoSave, ...pick(this, persistedKeys) });
  }
  /** Return the Data Segment to the first page of the data range, as after assembly, Reset, or a memory layout change. */
  resetDataView(): void {
    this.dataSegment = 'data';
    this.dataPageOffset = 0;
  }
  /** Show the Execute view's initial arrangement of a freshly built machine: the first data page and the general registers. */
  resetExecuteView(): void {
    this.resetDataView();
    this.registerTab = 'Registers';
  }
  /** Persist committed divider geometry through the validated layout adapter. */
  persistLayout = (): void => {
    savePaneLayout({
      registerWidth: this.displayedRegisterWidth,
      editorFraction: this.editorFraction,
      dataSegmentHeight: this.dataSegmentHeight
    });
  };
  /** Set the requested register sidebar width from an interactive pixel size. */
  setRegisterWidth = (width: number) => {
    this.registerWidth = Math.round(width);
  };
  /** Update the editor fraction from an interactive pixel size. */
  setEditorHeight = (height: number) => {
    this.editorFraction =
      clamp(height, EDITOR_MIN_HEIGHT, this.maxEditorHeight) / Math.max(1, this.leftPaneHeight);
  };
}
