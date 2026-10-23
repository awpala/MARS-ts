/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Menu structure and shortcuts derive from mars/venus/VenusUI.java. */
import { helpArticles } from '#lib/help/articles.js';
import type { IconSource } from '../../components/controls/IconButton.svelte';
import type { IconName } from '../../components/shell/MaskIcon.svelte';
import type { ToolbarIconName } from '../../components/shell/ToolbarIcon.svelte';
import { shortcutChords } from './shortcuts.js';

/** Toolbar icon of an action: an inline SVG glyph or a full-color bundled image. */
export type ActionIcon = Exclude<IconSource, { mask: IconName }>;

/** Immutable command presentation; execution and enablement belong to the desktop. */
export type Action = {
  /** Visible action label. */
  label: string;
  /** Optional toolbar icon; omitted for text-only actions. */
  icon?: ActionIcon;
  /** Stable identifier used by the desktop dispatcher. */
  command: string;
  /** Optional displayed keyboard shortcut. */
  shortcut?: string;
  /** True for a deliberately unavailable command; defaults to false. */
  unavailable?: boolean;
  /** True when a held shortcut key must not repeat the command; defaults to false. */
  noRepeat?: boolean;
};

const glyph = (name: ToolbarIconName): ActionIcon => ({ glyph: name });
const image = (name: IconName): ActionIcon => ({ image: name });

/** File commands in their displayed order. */
export const fileActions: readonly Action[] = [
  {
    label: 'New',
    icon: image('New'),
    command: 'new',
    shortcut: 'Alt+N / Option+N',
    noRepeat: true
  },
  { label: 'Open ...', icon: image('Open'), command: 'open', shortcut: 'Ctrl+O' },
  { label: 'Close', command: 'close', shortcut: 'Alt+W / Option+W', noRepeat: true },
  { label: 'Close All', command: 'closeAll' },
  { label: 'Save', icon: image('Save'), command: 'save', shortcut: 'Ctrl+S' },
  { label: 'Save as ...', icon: image('SaveAs'), command: 'saveAs', shortcut: 'Ctrl+Shift+S' },
  { label: 'Save All', command: 'saveAll' },
  { label: 'Auto Save', icon: glyph('autoSave'), command: 'autoSave' },
  { label: 'Import ...', icon: glyph('import'), command: 'import' },
  { label: 'Dump Memory ...', command: 'dump', unavailable: true },
  { label: 'Export', icon: glyph('export'), command: 'export' },
  { label: 'Export All', icon: glyph('exportAll'), command: 'exportAll' },
  { label: 'Exit', command: 'exit' }
];
/** Editor commands shared by menu, toolbar, and shortcuts. */
export const editActions: readonly Action[] = [
  { label: 'Undo', icon: image('Undo'), command: 'undo', shortcut: 'Ctrl+Z' },
  { label: 'Redo', icon: image('Redo'), command: 'redo', shortcut: 'Ctrl+Y / Ctrl+Shift+Z' },
  { label: 'Cut', icon: image('Cut'), command: 'cut' },
  { label: 'Copy', icon: image('Copy'), command: 'copy' },
  { label: 'Paste', icon: image('Paste'), command: 'paste' },
  { label: 'Find/Replace', icon: image('Find'), command: 'find', shortcut: 'Ctrl+F' },
  { label: 'Select All', command: 'selectAll' }
];
/** Execution commands shared by menu, toolbar, and shortcuts. */
export const runActions: readonly Action[] = [
  { label: 'Assemble', icon: glyph('assemble'), command: 'assemble', shortcut: 'F3' },
  { label: 'Go', icon: glyph('go'), command: 'go', shortcut: 'F5' },
  { label: 'Step', icon: glyph('step'), command: 'step', shortcut: 'F7' },
  { label: 'Backstep', icon: glyph('backstep'), command: 'backstep', shortcut: 'F8' },
  { label: 'Pause', icon: glyph('pause'), command: 'pause', shortcut: 'F9' },
  { label: 'Stop', icon: glyph('stop'), command: 'stop', shortcut: 'F11' },
  { label: 'Reset', icon: glyph('reset'), command: 'reset', shortcut: 'F12' }
];
/** Breakpoint toolbar commands. */
export const breakpointActions: readonly Action[] = [
  {
    label: 'Toggle all breakpoints',
    icon: glyph('breakpoints'),
    command: 'toggleBreakpoints',
    shortcut: 'Ctrl+T'
  },
  {
    label: 'Clear all breakpoints',
    icon: glyph('clearBreakpoints'),
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
  ...(article.id === 'help' ? { icon: image('Help'), shortcut: 'F1' } : {})
}));
/** Settings command opening the memory-layout dialog. */
export const memoryConfigurationAction: Action = {
  label: 'Memory Configuration ...',
  command: 'memoryConfiguration'
};

const allActions: readonly Action[] = [
  ...fileActions,
  ...editActions,
  ...runActions,
  ...breakpointActions,
  ...consoleActions,
  ...helpActions,
  memoryConfigurationAction
];
const actionsByCommand = new Map(allActions.map((action) => [action.command, action]));

/** The action registered for a command, or undefined for a command without presentation. */
export function actionFor(command: string): Action | undefined {
  return actionsByCommand.get(command);
}

/** The action registered for a command that must exist; an unknown command is a programming error. */
export function requireAction(command: string): Action {
  const action = actionsByCommand.get(command);
  if (!action) throw new Error(`Unknown command: ${command}`);
  return action;
}

/**
 * Resolve the displayed command shortcuts, accepting Meta as the platform equivalent of Ctrl.
 * Modifiers must match exactly; the desktop binding captures accepted chords before focused controls.
 */
export function keyboardAction(event: KeyboardEvent): Action | undefined {
  return allActions.find(
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

/**
 * Resolve a displayed Alt/Option+letter shortcut by its physical key, which survives the dead-key and composition
 * characters Option produces on macOS before an input consumes the event.
 */
export function physicalKeyAction(event: KeyboardEvent): Action | undefined {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  return allActions.find(
    (action) =>
      action.shortcut !== undefined &&
      shortcutChords(action.shortcut.toLowerCase()).some(
        ([modifier, letter, ...rest]) =>
          (modifier === 'alt' || modifier === 'option') &&
          letter?.length === 1 &&
          rest.length === 0 &&
          event.code === `Key${letter.toUpperCase()}`
      )
  );
}

/** Primary menus and their shared command definitions. */
export const menus = [
  { name: 'File', actions: fileActions },
  { name: 'Edit', actions: editActions },
  { name: 'Run', actions: runActions }
];

/** Tools that remain unavailable, in menu order. */
export const unavailableTools = [
  'BHT Simulator',
  'Bitmap Display',
  'Data Cache Simulator',
  'Digital Lab Sim',
  'Floating Point Representation',
  'Instruction Counter',
  'Instruction Statistics',
  'Keyboard and Display MMIO Simulator',
  'Memory Reference Visualization',
  'MIPS X-Ray',
  'Mars Bot',
  'ScavengerHunt',
  'Screen Magnifier',
  'Introduction to Tools'
];

/** Toolbar command groups; IDs remain stable when groups are reordered. */
export const toolbarGroups = [
  {
    id: 'file',
    label: 'File actions',
    actions: fileActions.filter((item) => item.icon)
  },
  { id: 'edit', label: 'Editing actions', actions: editActions.filter((item) => item.icon) },
  { id: 'run', label: 'Execution actions', actions: [...runActions, ...breakpointActions] }
] as const;
