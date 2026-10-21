/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Settings descriptions derive from mars/venus/VenusUI.java. */
import { Settings } from '#lib/engine/Settings.js';
import { helpArticles } from '#lib/help/articles.js';
import type { ToolbarIconName } from '../components/shell/ToolbarIcon.svelte';
import { shortcutChords } from './shortcuts.js';

/** Immutable command presentation; execution and enablement belong to the desktop. */
export type Action = {
  /** Visible action label. */
  label: string;
  /** Optional bundled image name; omitted for text-only or SVG actions. */
  icon?: string;
  /** Optional inline SVG glyph; omitted when using an image or text. */
  debugIcon?: ToolbarIconName;
  /** Stable identifier used by the desktop dispatcher. */
  command: string;
  /** Optional displayed keyboard shortcut. */
  shortcut?: string;
  /** True for a deliberately unavailable command; defaults to false. */
  unavailable?: boolean;
};
/** File commands in their displayed order. */
export const fileActions: readonly Action[] = [
  { label: 'New', icon: 'New', command: 'new', shortcut: 'Alt+N / Option+N' },
  { label: 'Open ...', icon: 'Open', command: 'open', shortcut: 'Ctrl+O' },
  { label: 'Close', command: 'close', shortcut: 'Alt+W / Option+W' },
  { label: 'Close All', command: 'closeAll' },
  { label: 'Save', icon: 'Save', command: 'save', shortcut: 'Ctrl+S' },
  { label: 'Save as ...', icon: 'SaveAs', command: 'saveAs', shortcut: 'Ctrl+Shift+S' },
  { label: 'Save All', command: 'saveAll' },
  { label: 'Auto Save', debugIcon: 'autoSave', command: 'autoSave' },
  { label: 'Import ...', debugIcon: 'import', command: 'import' },
  { label: 'Dump Memory ...', command: 'dump', unavailable: true },
  { label: 'Export', debugIcon: 'export', command: 'export' },
  { label: 'Export All', debugIcon: 'exportAll', command: 'exportAll' },
  { label: 'Exit', command: 'exit' }
];
/** Editor commands shared by menu, toolbar, and shortcuts. */
export const editActions: readonly Action[] = [
  { label: 'Undo', icon: 'Undo', command: 'undo', shortcut: 'Ctrl+Z' },
  { label: 'Redo', icon: 'Redo', command: 'redo', shortcut: 'Ctrl+Y / Ctrl+Shift+Z' },
  { label: 'Cut', icon: 'Cut', command: 'cut' },
  { label: 'Copy', icon: 'Copy', command: 'copy' },
  { label: 'Paste', icon: 'Paste', command: 'paste' },
  { label: 'Find/Replace', icon: 'Find', command: 'find', shortcut: 'Ctrl+F' },
  { label: 'Select All', command: 'selectAll' }
];
/** Execution commands shared by menu, toolbar, and shortcuts. */
export const runActions: readonly Action[] = [
  { label: 'Assemble', debugIcon: 'assemble', command: 'assemble', shortcut: 'F3' },
  { label: 'Go', debugIcon: 'go', command: 'go', shortcut: 'F5' },
  { label: 'Step', debugIcon: 'step', command: 'step', shortcut: 'F7' },
  { label: 'Backstep', debugIcon: 'backstep', command: 'backstep', shortcut: 'F8' },
  { label: 'Pause', debugIcon: 'pause', command: 'pause', shortcut: 'F9' },
  { label: 'Stop', debugIcon: 'stop', command: 'stop', shortcut: 'F11' },
  { label: 'Reset', debugIcon: 'reset', command: 'reset', shortcut: 'F12' }
];
/** Breakpoint toolbar commands. */
export const breakpointActions: readonly Action[] = [
  {
    label: 'Toggle all breakpoints',
    debugIcon: 'breakpoints',
    command: 'toggleBreakpoints',
    shortcut: 'Ctrl+T'
  },
  {
    label: 'Clear all breakpoints',
    debugIcon: 'clearBreakpoints',
    command: 'clearBreakpoints',
    shortcut: 'Ctrl+K'
  }
];
/** Console commands available throughout the desktop. */
export const consoleActions: readonly Action[] = [
  { label: 'Clear', command: 'clearOutput', shortcut: 'Ctrl+L' },
  { label: 'Clear All', command: 'clearAllOutput', shortcut: 'Alt+L / Option+L' }
];
/** Help commands derived from the article catalog. */
export const helpActions: readonly Action[] = helpArticles.map((article) => ({
  label: article.label,
  command: article.id,
  ...(article.id === 'help' ? { icon: 'Help', shortcut: 'F1' } : {})
}));
const keyboardActions = [
  ...fileActions,
  ...editActions,
  ...runActions,
  ...breakpointActions,
  ...consoleActions,
  ...helpActions
];

/**
 * Resolve the displayed command shortcuts, accepting Meta as the platform equivalent of Ctrl.
 * Modifiers must match exactly; the desktop binding captures accepted chords before focused controls.
 */
export function keyboardAction(event: KeyboardEvent): Action | undefined {
  return keyboardActions.find(
    (action) =>
      action.shortcut !== undefined &&
      shortcutChords(action.shortcut.toLowerCase()).some(
        (keys) =>
          keys.at(-1) === event.key.toLowerCase() &&
          keys.includes('ctrl') === (event.ctrlKey || event.metaKey) &&
          keys.includes('shift') === event.shiftKey &&
          (keys.includes('alt') || keys.includes('option')) === event.altKey
      )
  );
}
/** Primary menus and their shared command definitions. */
export const menus = [
  { name: 'File', actions: fileActions },
  { name: 'Edit', actions: editActions },
  { name: 'Run', actions: runActions }
];
/** Popup input setting shared by display controls and engine initialization. */
export const popupInputOption = {
  id: Settings.POPUP_SYSCALL_INPUT,
  label: 'Popup dialog for input syscalls'
};
/** Program-argument preference shared by the Settings menu and Args toolbar toggle. */
export const programArgumentsOption = {
  id: Settings.PROGRAM_ARGUMENTS,
  label: 'Program arguments provided to MIPS program'
};
/** Engine settings exposed by the desktop. */
export const engineOptions = [
  popupInputOption,
  programArgumentsOption,
  { id: Settings.ASSEMBLE_ON_OPEN_ENABLED, label: 'Assemble file on open' },
  { id: Settings.WARNINGS_ARE_ERRORS, label: 'Assembler warnings are considered errors' },
  { id: Settings.START_AT_MAIN, label: 'Initialize Program Counter to global main if defined' },
  {
    id: Settings.EXTENDED_ASSEMBLER_ENABLED,
    label: 'Permit extended (pseudo) instructions and formats'
  },
  { id: Settings.DELAYED_BRANCHING_ENABLED, label: 'Delayed branching' },
  { id: Settings.SELF_MODIFYING_CODE_ENABLED, label: 'Self-modifying code' }
];
/** Settings whose dialogs are not implemented. */
export const pendingSettings = ['Exception Handler ...'];

/** Legacy Settings action descriptions; the console-clearing option is browser-specific. */
export const settingsTooltips: Readonly<Record<string, string>> = {
  args: 'If set, program arguments for MIPS program can be entered in border of Text Segment window.',
  labels: 'Toggle visibility of Labels window (symbol table) in the Execute tab',
  input:
    'If set, use popup dialog for input syscalls (5,6,7,8,12) instead of cursor in Run I/O window',
  addresses: 'Toggle between hexadecimal and decimal display of memory addresses',
  values: 'Toggle between hexadecimal and decimal display of memory/register values',
  [Settings.ASSEMBLE_ON_OPEN_ENABLED]:
    'If set, a file will be automatically assembled as soon as it is opened.  File Open dialog will show most recently opened file.',
  [Settings.WARNINGS_ARE_ERRORS]:
    'If set, assembler warnings will be interpreted as errors and prevent successful assembly.',
  [Settings.START_AT_MAIN]:
    "If set, assembler will initialize Program Counter to text address globally labeled 'main', if defined.",
  [Settings.EXTENDED_ASSEMBLER_ENABLED]:
    'If set, MIPS extended (pseudo) instructions are formats are permitted.',
  [Settings.DELAYED_BRANCHING_ENABLED]:
    'If set, delayed branching will occur during MIPS execution.',
  [Settings.SELF_MODIFYING_CODE_ENABLED]:
    'If set, the MIPS program can write and branch to both text and data segments.',
  clearAllOutputsOnGo: 'If set, clear Mars Messages and Run I/O before each Go, including resume.',
  'Exception Handler ...':
    'If set, the specified exception handler file will be included in all Assemble operations.',
  memoryConfiguration: 'View and modify memory segment base addresses for simulated MIPS.'
};

/** A live display preference shared by Settings and toolbar rendering. */
export type DisplayToggle = {
  /** Stable SVG glyph and preference identity. */
  icon: ToolbarIconName;
  /** Accessible label shared by all controls for this preference. */
  label: string;
  /** Current parent-owned value. */
  active: boolean;
  /** True when the parent disallows changes. */
  disabled: boolean;
  /** Request that the parent invert the preference. */
  toggle: () => void;
};

/** Toolbar command groups; IDs remain stable when groups are reordered. */
export const toolbarGroups = [
  {
    id: 'file',
    label: 'File actions',
    actions: fileActions.filter((item) => item.icon || item.debugIcon)
  },
  { id: 'edit', label: 'Editing actions', actions: editActions.filter((item) => item.icon) },
  { id: 'run', label: 'Execution actions', actions: [...runActions, ...breakpointActions] }
] as const;
