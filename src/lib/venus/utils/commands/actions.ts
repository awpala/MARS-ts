/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Menu structure and shortcuts derive from mars/venus/VenusUI.java. */
import { helpArticles } from '#lib/help/articles.js';
import type { IconSource } from '../../components/icons/Icon.svelte';
import type { IconName } from '../../components/icons/MaskIcon.svelte';
import type { ToolbarIconName } from '../../components/icons/ToolbarIcon.svelte';
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
    shortcut: 'Alt/Option+N',
    noRepeat: true
  },
  { label: 'Open ...', icon: image('Open'), command: 'open', shortcut: 'Ctrl+O' },
  { label: 'Close', command: 'close', shortcut: 'Alt/Option+W', noRepeat: true },
  {
    label: 'Close All',
    icon: glyph('CloseAll'),
    command: 'closeAll',
    shortcut: 'Alt/Option+Shift+W',
    noRepeat: true
  },
  { label: 'Save', icon: image('Save'), command: 'save', shortcut: 'Ctrl+S' },
  { label: 'Save as ...', icon: image('SaveAs'), command: 'saveAs', shortcut: 'Ctrl+Shift+S' },
  { label: 'Save All', command: 'saveAll' },
  { label: 'Auto Save', icon: glyph('AutoSave'), command: 'autoSave' },
  { label: 'Import ...', icon: glyph('Import'), command: 'import' },
  { label: 'Dump Memory ...', icon: glyph('Dump'), command: 'dump', shortcut: 'Ctrl+D' },
  { label: 'Export', icon: glyph('Export'), command: 'export' },
  { label: 'Export All', icon: glyph('ExportAll'), command: 'exportAll' }
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
  { label: 'Assemble', icon: glyph('Assemble'), command: 'assemble', shortcut: 'F3' },
  { label: 'Go', icon: glyph('Go'), command: 'go', shortcut: 'F5' },
  { label: 'Step', icon: glyph('Step'), command: 'step', shortcut: 'F7' },
  { label: 'Backstep', icon: glyph('Backstep'), command: 'backstep', shortcut: 'F8' },
  { label: 'Pause', icon: glyph('Pause'), command: 'pause', shortcut: 'F9' },
  { label: 'Stop', icon: glyph('Stop'), command: 'stop', shortcut: 'F11' },
  { label: 'Reset', icon: glyph('Reset'), command: 'reset', shortcut: 'F12' }
];
/** Breakpoint toolbar commands, in toolbar order; the Run menu lists them in reverse, as in VenusUI. */
export const breakpointActions: readonly Action[] = [
  {
    label: 'Toggle all breakpoints',
    icon: glyph('Breakpoints'),
    command: 'toggleBreakpoints',
    shortcut: 'Alt/Option+T'
  },
  {
    label: 'Clear all breakpoints',
    icon: glyph('ClearBreakpoints'),
    command: 'clearBreakpoints',
    shortcut: 'Ctrl+K'
  }
];
/** Advice shown on breakpoint controls locked at unlimited run speed. */
export const frozenBreakpointsHint = 'lower the run speed to change breakpoints';
/** Console commands available throughout the desktop. */
export const consoleActions: readonly Action[] = [
  { label: 'Clear', command: 'clearOutput', shortcut: 'Ctrl+L' },
  { label: 'Clear All', command: 'clearAllOutput', shortcut: 'Alt/Option+L' }
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
  icon: glyph('Memory'),
  command: 'memoryConfiguration'
};
/** Settings command opening the automatic exception-handler selection dialog. */
export const exceptionHandlerAction: Action = {
  label: 'Exception Handler ...',
  icon: glyph('Exceptions'),
  command: 'exceptionHandler'
};

const allActions: readonly Action[] = [
  ...fileActions,
  ...editActions,
  ...runActions,
  ...breakpointActions,
  ...consoleActions,
  ...helpActions,
  memoryConfigurationAction,
  exceptionHandlerAction
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
          keys.includes('alt/option') === event.altKey
      )
  );
}

/**
 * Resolve a displayed Alt/Option+letter or Alt/Option+Shift+letter shortcut by its physical key, which survives the dead-key
 * and composition characters Option produces on macOS before an input consumes the event. Shift must match the chord exactly.
 */
export function physicalKeyAction(event: KeyboardEvent): Action | undefined {
  if (!event.altKey || event.ctrlKey || event.metaKey) return;
  return allActions.find(
    (action) =>
      action.shortcut !== undefined &&
      shortcutChords(action.shortcut.toLowerCase()).some((keys) => {
        const letter = keys.at(-1)!;
        const modifiers = keys.slice(0, -1);
        return (
          modifiers[0] === 'alt/option' &&
          (modifiers.length === 1 || (modifiers.length === 2 && modifiers[1] === 'shift')) &&
          modifiers.includes('shift') === event.shiftKey &&
          letter.length === 1 &&
          event.code === `Key${letter.toUpperCase()}`
        );
      })
  );
}

/** Primary menus and their shared command definitions, in separator-delimited groups. */
export const menus: readonly { name: string; groups: readonly (readonly Action[])[] }[] = [
  { name: 'File', groups: [fileActions] },
  { name: 'Edit', groups: [editActions] },
  { name: 'Run', groups: [runActions, [...breakpointActions].reverse()] }
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
    actions: [
      ...fileActions.filter((item) => item.icon && item.command !== 'dump'),
      requireAction('dump')
    ]
  },
  { id: 'edit', label: 'Editing actions', actions: editActions.filter((item) => item.icon) },
  {
    id: 'run',
    label: 'Execution actions',
    actions: [...runActions, ...breakpointActions, exceptionHandlerAction]
  }
] as const;
