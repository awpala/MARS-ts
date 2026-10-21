import { Settings } from '#lib/engine/Settings.js';
import { helpArticles } from '#lib/help/articles.js';
import type { ToolbarIconName } from '../components/shell/ToolbarIcon.svelte';

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
	{ label: 'Close', command: 'close' },
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
	{ label: 'Clear All', command: 'clearAllOutput', shortcut: 'Ctrl+Shift+L' }
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
	return keyboardActions.find((action) =>
		action.shortcut?.split(' / ').some((chord) => {
			const keys = chord.toLowerCase().split('+');
			return (
				keys.at(-1) === event.key.toLowerCase() &&
				keys.includes('ctrl') === (event.ctrlKey || event.metaKey) &&
				keys.includes('shift') === event.shiftKey &&
				(keys.includes('alt') || keys.includes('option')) === event.altKey
			);
		})
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
/** Engine settings exposed by the desktop. */
export const engineOptions = [
	popupInputOption,
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
export const pendingSettings = ['Exception Handler ...', 'Memory Configuration ...'];

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
