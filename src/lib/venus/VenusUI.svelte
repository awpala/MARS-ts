<script lang="ts">
	/**
	 * Ports the layout/action responsibilities of mars/venus/VenusUI.java, MainPane.java,
	 * MessagesPane.java, ExecutePane.java, and RunSpeedPanel.java.
	 * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
	 */
	import { asset } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { highlightSource } from '#lib/editor/highlighting/MIPSTokenMarker.js';
	import { Token } from '#lib/editor/highlighting/Token.js';
	import { Directives } from '#lib/engine/assembler/Directives.js';
	import editorPreset from '#lib/editor/editor-preset.json';
	import { loadPaneLayout, savePaneLayout } from '#lib/browser/PaneLayout.js';
	import { loadDisplaySettings, saveDisplaySettings } from '#lib/browser/DisplaySettings.js';
	import { Editor, type EditPane } from '#lib/editor/Editor.js';
	import { downloadSource } from '#lib/browser/download.js';
	import { SourceLibrary, sourceName, type SavedSource } from '#lib/browser/SourceLibrary.js';
	import Modal from './Modal.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import RegistersPane from './RegistersPane.svelte';
	import ExecutePane from './ExecutePane.svelte';
	import ToolbarIcon, { type ToolbarIconName } from './ToolbarIcon.svelte';
	import { Globals } from '#lib/engine/Globals.js';
	import { ProcessingException } from '#lib/engine/diagnostics/ProcessingException.js';
	import { Settings } from '#lib/engine/Settings.js';
	import type { InputRequest } from '#lib/engine/io/SystemIO.js';
	import { Simulator } from '#lib/engine/simulator/Simulator.js';
	import { RunController } from './RunController.js';

	const icons: Record<string, string> = {
		Previous: asset('icons/Previous.svg'),
		Paste: asset('icons/Paste.svg'),
		Redo: asset('icons/Redo.svg'),
		Next: asset('icons/Next.svg'),
		Open: asset('icons/Open.svg'),
		Dump: asset('icons/Dump.svg'),
		Help: asset('icons/Help.svg'),
		Find: asset('icons/Find.svg'),
		SaveAs: asset('icons/SaveAs.svg'),
		New: asset('icons/New.svg'),
		Undo: asset('icons/Undo.svg'),
		Save: asset('icons/Save.svg'),
		Copy: asset('icons/Copy.svg'),
		Cut: asset('icons/Cut.svg')
	};
	const paneId = $props.id();
	let ready = $state(false);
	let desktopVisible = $state(false);
	const initializeDesktop = () => {
		let recoveredConflict = false;
		try {
			libraryFiles = sourceLibrary.read();
		} catch (error) {
			fileFailure(error);
		}
		try {
			const drafts = sourceLibrary.readWorkspace();
			let selected: number | undefined;
			for (const draft of drafts) {
				const saved = libraryFiles.find((file) => file.name === draft.name);
				const clean = !draft.isNew && draft.source === draft.savedSource;
				const matchesSaved = saved?.source === draft.source;
				if (saved && !clean && !matchesSaved && saved.source !== draft.savedSource)
					recoveredConflict = true;
				const tab =
					saved && (clean || matchesSaved)
						? editor.openFile(saved.name, saved.source)
						: editor.restoreFile(draft.name, draft.source, draft.savedSource, draft.isNew);
				if (draft.selected) selected = tab.id;
			}
			if (selected !== undefined) editor.setCurrentEditTab(selected);
			workspaceWritable = true;
			refresh();
		} catch (error) {
			backupError = `Unable to restore source workspace: ${error instanceof Error ? error.message : String(error)}. Existing backup has been preserved.`;
		}
		const layout = loadPaneLayout();
		if (layout) {
			registerWidth = layout.registerWidth;
			editorFraction = layout.editorFraction;
		}
		const settings = loadDisplaySettings();
		if (settings) {
			autoSave = settings.autoSave;
			ascii = settings.ascii;
			showLabels = settings.showLabels;
			showDataLabels = settings.showDataLabels;
			showTextLabels = settings.showTextLabels;
			labelSortState = settings.labelSortState;
			showLines = settings.showLines;
			hexValues = settings.hexValues;
			hexAddresses = settings.hexAddresses;
			speed = settings.speed;
		}
		if (recoveredConflict) {
			autoSave = false;
			autoSaveError =
				'A recovered draft differs from its latest saved source. Both versions are retained; Auto Save is off. Review the draft before saving or enabling Auto Save.';
		}
		let disposed = false;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- Scheduler handles are owned resources, never rendered reactive state.
		const timers = new Map<ReturnType<typeof setTimeout>, () => void>();
		const wake = () => {
			for (const [timer, resolve] of timers) {
				clearTimeout(timer);
				resolve();
			}
			timers.clear();
		};
		const session: Globals = new Globals({
			readSource: (name) => {
				const tab = editor
					.getEditPanes()
					.find((entry) => normalizePath(entry.name) === normalizePath(name));
				if (tab) return tab.text;
				const saved = sourceLibrary.read().find((entry) => entry.name === normalizePath(name));
				if (!saved) throw new Error(`Source file "${name}" is not in the source library.`);
				return saved.source;
			},
			sourcePaths: {
				separator: '/',
				isAbsolute: (name) => name.startsWith('/'),
				getParent: (name) => (name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : '')
			},
			readInput: (request) =>
				new Promise<string>((resolve) => {
					if (disposed || session.simulator.isStopRequested()) {
						resolve(inputText);
						return;
					}
					inputText = '';
					inputRequest = request;
					resolveInput = resolve;
					messageTab = 'Run I/O';
				}),
			printString: (text) => {
				if (!disposed) {
					runIO = (runIO + text).slice(-Globals.maximumMessageCharacters);
					messageTab = 'Run I/O';
				}
			},
			yieldControl: (milliseconds) =>
				new Promise<void>((resolve) => {
					const timer = setTimeout(() => {
						timers.delete(timer);
						resolve();
					}, milliseconds);
					timers.set(timer, resolve);
				}),
			releaseInput: () => {
				completeInput(false);
				wake();
			},
			refresh: () => controller?.refresh(),
			preferences: {
				readPreference: (key) => {
					try {
						return localStorage.getItem(`mars-ts:engine-settings:v1:${key}`);
					} catch {
						return null;
					}
				},
				writePreference: (key, value) => {
					try {
						localStorage.setItem(`mars-ts:engine-settings:v1:${key}`, value);
					} catch {
						/* Session settings remain usable when persistence is blocked. */
					}
				}
			}
		});
		machine = session;
		const controls = new RunController(session);
		controller = controls;
		engineSettings = Object.fromEntries(
			engineOptions.map((option) => [option.id, session.getSettings().getBooleanSetting(option.id)])
		);
		const release = controls.subscribe((state) => {
			if (!disposed) execution = state;
		});
		execution = controls.getState();
		ready = true;
		refresh();
		let revealFrame: number | undefined;
		// Measure restored panes while hidden, then reveal after the first layout frame.
		void tick().then(() => {
			if (disposed) return;
			revealFrame = requestAnimationFrame(() => {
				revealFrame = requestAnimationFrame(() => {
					if (!disposed) desktopVisible = true;
				});
			});
		});
		return () => {
			disposed = true;
			if (revealFrame !== undefined) cancelAnimationFrame(revealFrame);
			release();
			void controls.dispose().finally(wake);
		};
	};
	onMount(() => {
		let cleanup: (() => void) | undefined;
		// Let the loading indicator paint before synchronous engine initialization begins.
		let initializeFrame = requestAnimationFrame(() => {
			initializeFrame = requestAnimationFrame(() => {
				cleanup = initializeDesktop();
			});
		});
		return () => {
			cancelAnimationFrame(initializeFrame);
			cleanup?.();
		};
	});
	$effect(() => {
		if (ready)
			saveDisplaySettings({
				autoSave,
				ascii,
				showLabels,
				showDataLabels,
				showTextLabels,
				labelSortState,
				showLines,
				hexValues,
				hexAddresses,
				speed
			});
	});
	const syntaxStyles = editorPreset.syntaxStyles;
	const editor = new Editor();
	let machine = $state.raw<Globals>();
	let controller = $state.raw<RunController>();
	let execution = $state.raw<ReturnType<RunController['getState']>>();
	let breakpoints = $state.raw<number[]>([]);
	let breakpointsEnabled = $state(true);
	let engineSettings = $state<Record<number, boolean>>({});
	let inputRequest = $state.raw<InputRequest | null>(null);
	let inputText = $state('');
	let resolveInput: ((text: string) => void) | undefined;
	const running = $derived(execution?.status === 'running');
	let revision = $state(0);
	let tabs = $derived.by(() => {
		void revision;
		return editor.getEditPanes().map((tab) => ({ ...tab }));
	});
	let current = $derived.by(() => {
		void revision;
		const tab = editor.getCurrentEditTab();
		return tab ? { ...tab, undo: [...tab.undo], redo: [...tab.redo] } : undefined;
	});
	const highlighted = $derived(highlightSource(current?.text ?? ''));
	let sourceHelp = $state.raw<{
		buffer: number;
		source: string;
		start: number;
		left: number;
		edge: number;
		above: boolean;
		entries: { example: string; description: string }[];
	} | null>(null);
	const visibleSourceHelp = $derived(
		sourceHelp && sourceHelp.buffer === current?.id && sourceHelp.source === current.text
			? sourceHelp
			: null
	);
	let view = $state('Edit');
	let registerTab = $state('Registers');
	let messageTab = $state('Mars Messages');
	let messages = $state('');
	let runIO = $state('');
	const sourceLibrary = new SourceLibrary();
	let libraryFiles = $state.raw<SavedSource[]>([]);
	let selectedSources = $state<string[]>([]);
	let importSources = $state.raw<SavedSource[]>([]);
	let fileError = $state('');
	let backupError = $state('');
	let autoSave = $state(false);
	let autoSaveError = $state('');
	let workspaceWritable = false;
	let replaceSave = $state(false);
	let renameSource = $state(false);
	let modal = $state<
		'open' | 'delete' | 'import' | 'save' | 'close' | 'find' | 'help' | 'about' | null
	>(null);
	let filename = $state('');
	let saveTarget = $state.raw<EditPane>();
	let closeQueue: number[] = [];
	let saveQueue: number[] = [];
	let closingAfterSave = false;
	let findText = $state('');
	let replacement = $state('');
	let caseSensitive = $state(false);
	let findStatus = $state('');
	let showLabels = $state(false);
	let showDataLabels = $state(true);
	let showTextLabels = $state(true);
	let labelSortState = $state(0);
	let showLines = $state(true);
	let ascii = $state(false);
	let hexValues = $state(true);
	let hexAddresses = $state(true);
	let speed = $state(40);
	let selectionStart = $state(0);
	let selectionEnd = $state(0);
	let scrollTop = $state(0);
	let scrollLeft = $state(0);
	let workspaceWidth = $state(1000);
	let registerWidth = $state(310);
	let leftPaneHeight = $state(700);
	let editorFraction = $state(0.75);
	const maxEditorHeight = $derived(Math.max(150, leftPaneHeight - 85));
	const displayedEditorHeight = $derived(
		Math.max(150, Math.min(maxEditorHeight, Math.round(leftPaneHeight * editorFraction)))
	);
	let editorResizeDrag: { pointer: number; startY: number; height: number } | undefined;
	const maxRegisterWidth = $derived(Math.max(260, workspaceWidth - 315));
	const displayedRegisterWidth = $derived(Math.min(registerWidth, maxRegisterWidth));
	let resizeDrag: { pointer: number; startX: number; width: number } | undefined;
	let fileInput: HTMLInputElement;
	let sourceInput = $state<HTMLTextAreaElement>();
	const speedTable = [
		0.05,
		0.1,
		0.2,
		0.3,
		0.4,
		0.5,
		...Array.from({ length: 30 }, (_, i) => i + 1)
	];
	const runSpeed = $derived(speed > 35 ? 'unlimited' : `${speedTable[speed]} inst/sec`);
	const position = $derived.by(() => {
		const before = current?.text.slice(0, selectionStart) ?? '';
		return { line: before.split('\n').length, column: before.length - before.lastIndexOf('\n') };
	});
	type Action = {
		label: string;
		icon?: string;
		debugIcon?: ToolbarIconName;
		command: string;
		shortcut?: string;
		unavailable?: boolean;
	};
	const fileActions: Action[] = [
		{ label: 'New', icon: 'New', command: 'new', shortcut: 'Alt+N / Option+N' },
		{ label: 'Open ...', icon: 'Open', command: 'open', shortcut: 'Ctrl+O' },
		{ label: 'Close', command: 'close' },
		{ label: 'Close All', command: 'closeAll' },
		{ label: 'Save', icon: 'Save', command: 'save', shortcut: 'Ctrl+S' },
		{ label: 'Save as ...', icon: 'SaveAs', command: 'saveAs' },
		{ label: 'Save All', command: 'saveAll' },
		{ label: 'Auto Save', debugIcon: 'autoSave', command: 'autoSave' },
		{ label: 'Import ...', debugIcon: 'import', command: 'import' },
		{ label: 'Dump Memory ...', command: 'dump', unavailable: true },
		{ label: 'Export', debugIcon: 'export', command: 'export' },
		{ label: 'Export All', debugIcon: 'exportAll', command: 'exportAll' },
		{ label: 'Exit', command: 'exit' }
	];
	const editActions: Action[] = [
		{ label: 'Undo', icon: 'Undo', command: 'undo', shortcut: 'Ctrl+Z' },
		{ label: 'Redo', icon: 'Redo', command: 'redo', shortcut: 'Ctrl+Y' },
		{ label: 'Cut', icon: 'Cut', command: 'cut' },
		{ label: 'Copy', icon: 'Copy', command: 'copy' },
		{ label: 'Paste', icon: 'Paste', command: 'paste' },
		{ label: 'Find/Replace', icon: 'Find', command: 'find', shortcut: 'Ctrl+F' },
		{ label: 'Select All', command: 'selectAll' }
	];
	const runActions: Action[] = [
		{ label: 'Assemble', debugIcon: 'assemble', command: 'assemble', shortcut: 'F3' },
		{ label: 'Go', debugIcon: 'go', command: 'go', shortcut: 'F5' },
		{ label: 'Step', debugIcon: 'step', command: 'step', shortcut: 'F7' },
		{ label: 'Backstep', debugIcon: 'backstep', command: 'backstep', shortcut: 'F8' },
		{ label: 'Pause', debugIcon: 'pause', command: 'pause', shortcut: 'F9' },
		{ label: 'Stop', debugIcon: 'stop', command: 'stop', shortcut: 'F11' },
		{ label: 'Reset', debugIcon: 'reset', command: 'reset', shortcut: 'F12' }
	];
	const breakpointActions: Action[] = [
		{ label: 'Toggle all breakpoints', debugIcon: 'breakpoints', command: 'toggleBreakpoints' },
		{ label: 'Clear all breakpoints', debugIcon: 'clearBreakpoints', command: 'clearBreakpoints' }
	];
	const helpActions: Action[] = [
		{ label: 'Help', icon: 'Help', command: 'help', shortcut: 'F1' },
		{ label: 'About MARS', command: 'about' }
	];
	const menus = [
		{ name: 'File', actions: fileActions },
		{ name: 'Edit', actions: editActions },
		{ name: 'Run', actions: runActions }
	];
	const popupInputOption = {
		id: Settings.POPUP_SYSCALL_INPUT,
		label: 'Popup dialog for input syscalls'
	};
	const engineOptions = [
		popupInputOption,
		{ id: Settings.ASSEMBLE_ON_OPEN_ENABLED, label: 'Assemble file on open' },
		{ id: Settings.ASSEMBLE_ALL_ENABLED, label: 'Assemble all open files in editor' },
		{ id: Settings.WARNINGS_ARE_ERRORS, label: 'Assembler warnings are considered errors' },
		{ id: Settings.START_AT_MAIN, label: 'Initialize Program Counter to global main if defined' },
		{
			id: Settings.EXTENDED_ASSEMBLER_ENABLED,
			label: 'Permit extended (pseudo) instructions and formats'
		},
		{ id: Settings.DELAYED_BRANCHING_ENABLED, label: 'Delayed branching' },
		{ id: Settings.SELF_MODIFYING_CODE_ENABLED, label: 'Self-modifying code' }
	];
	const pendingSettings = ['Exception Handler ...', 'Memory Configuration ...'];
	const displayToggles = $derived([
		{
			icon: 'labels' as const,
			label: 'Show Labels Window',
			active: showLabels,
			toggle: () => (showLabels = !showLabels),
			disabled: false
		},
		{
			icon: 'addresses' as const,
			label: 'Addresses displayed in hexadecimal',
			active: hexAddresses,
			toggle: () => (hexAddresses = !hexAddresses),
			disabled: false
		},
		{
			icon: 'values' as const,
			label: 'Values displayed in hexadecimal',
			active: hexValues,
			toggle: () => (hexValues = !hexValues),
			disabled: false
		},
		{
			icon: 'ascii' as const,
			label: 'Display Data Segment values as ASCII',
			active: ascii,
			toggle: () => (ascii = !ascii),
			disabled: false
		},
		{
			icon: 'lines' as const,
			label: 'Show line numbers',
			active: showLines,
			toggle: () => (showLines = !showLines),
			disabled: false
		},
		{
			icon: 'input' as const,
			label: popupInputOption.label,
			active: engineSettings[Settings.POPUP_SYSCALL_INPUT] ?? false,
			toggle: () =>
				updateEngineSetting(
					Settings.POPUP_SYSCALL_INPUT,
					!engineSettings[Settings.POPUP_SYSCALL_INPUT]
				),
			disabled: running
		}
	]);
	$effect(() => {
		if (machine) {
			machine.runSpeed = speed > 35 ? 40 : speedTable[speed];
			machine
				.getSettings()
				.setBooleanSettingNonPersistent(Settings.DISPLAY_VALUES_IN_HEX, hexValues);
			machine
				.getSettings()
				.setBooleanSettingNonPersistent(Settings.DISPLAY_ADDRESSES_IN_HEX, hexAddresses);
			controller?.refresh();
		}
	});
	function normalizePath(name: string): string {
		const parts: string[] = [];
		for (const part of name.split('/')) {
			if (part === '..') parts.pop();
			else if (part !== '.' && part !== '') parts.push(part);
		}
		return parts.join('/');
	}
	function updateEngineSetting(id: number, value: boolean) {
		machine?.getSettings().setBooleanSetting(id, value);
		engineSettings = { ...engineSettings, [id]: value };
		if (
			![
				Settings.POPUP_SYSCALL_INPUT,
				Settings.ASSEMBLE_ON_OPEN_ENABLED,
				Settings.SELF_MODIFYING_CODE_ENABLED
			].includes(id)
		)
			controller?.invalidate();
		else controller?.refresh();
	}
	function completeInput(appendNewline: boolean) {
		const resolve = resolveInput;
		const request = inputRequest;
		if (!resolve || !request) return;
		resolveInput = undefined;
		const consoleInput = request.prompt === null;
		const text = inputText + (appendNewline && consoleInput ? '\n' : '');
		inputRequest = null;
		runIO = (runIO + (consoleInput ? text : `**** user input : ${text}\n`)).slice(
			-Globals.maximumMessageCharacters
		);
		resolve(consoleInput && request.maxLength >= 0 ? text.slice(0, request.maxLength) : text);
	}
	function consoleInputChanged(event: Event) {
		inputText = (event.currentTarget as HTMLTextAreaElement).value;
		const newline = inputText.indexOf('\n');
		if (newline >= 0) {
			inputText = inputText.slice(0, newline) + inputText.slice(newline + 1) + '\n';
			completeInput(false);
		} else if (
			inputRequest &&
			inputRequest.maxLength >= 0 &&
			inputText.length >= inputRequest.maxLength
		)
			completeInput(false);
	}
	function focusInput(element: HTMLInputElement | HTMLTextAreaElement) {
		element.focus();
	}
	function toggleBreakpoint(address: number) {
		breakpoints = breakpoints.includes(address)
			? breakpoints.filter((value) => value !== address)
			: [...breakpoints, address];
	}
	async function showSource(name: string, line: number) {
		const tab = editor
			.getEditPanes()
			.find((entry) => normalizePath(entry.name) === normalizePath(name));
		if (!tab) return;
		select(tab.id);
		view = 'Edit';
		await tick();
		const offset = tab.text
			.split('\n')
			.slice(0, Math.max(0, line - 1))
			.reduce((total, text) => total + text.length + 1, 0);
		sourceInput?.focus();
		sourceInput?.setSelectionRange(offset, offset);
		if (sourceInput) sourceInput.scrollTop = Math.max(0, (line - 3) * 21);
		selection();
	}
	function assemble() {
		if (!controller || !current) return;
		try {
			const diagnostics = controller.assemble(
				tabs.map((tab) => tab.name),
				current.name
			);
			if (diagnostics) messages += diagnostics.generateErrorAndWarningReport();
			if (controller.getState().status === 'assembled') {
				messages += `Assemble: operation completed successfully.\n\n`;
				breakpoints = [];
				breakpointsEnabled = true;
				view = 'Execute';
			} else messages += 'Assemble: operation completed with errors.\n';
		} catch (error) {
			report(error);
			messages += 'Assemble: operation completed with errors.\n\n';
		}
		messageTab = 'Mars Messages';
	}
	async function runCommand(command: string) {
		if (!controller) return;
		try {
			if (command === 'assemble') {
				assemble();
				return;
			}
			if (command === 'clearBreakpoints') {
				breakpoints = [];
				return;
			}
			if (command === 'toggleBreakpoints') {
				breakpointsEnabled = !breakpointsEnabled;
				return;
			}
			if (command === 'pause') {
				controller.pause();
				return;
			}
			if (command === 'stop') {
				controller.stop();
				return;
			}
			view = 'Execute';
			if (command === 'reset') {
				controller.reset();
				runIO += '\nReset: reset completed.\n\n';
				registerTab = 'Registers';
				return;
			}
			if (command === 'backstep') {
				controller.backStep();
				return;
			}
			messageTab = 'Run I/O';
			const name = command === 'step' ? 'Step' : 'Go';
			const filename = current?.name ?? '';
			if (command === 'step') await controller.step();
			else {
				messages += `Go: running ${filename}\n\n`;
				await controller.run(breakpointsEnabled ? breakpoints : []);
			}
			const result = controller.getState();
			if (result.error) {
				messages += result.error.errors()?.generateErrorReport() ?? '';
				messages += `\n${name}: execution terminated with errors.\n\n`;
				messageTab = 'Mars Messages';
				registerTab = 'Coproc 0';
			} else if (result.status === 'terminated') {
				if (command === 'step') {
					const cliff = result.reason === Simulator.CLIFF_TERMINATION;
					messages += `\nStep: execution ${cliff ? 'terminated due to null instruction.' : 'completed successfully.'}\n\n`;
					runIO += `\n-- program is finished running ${cliff ? '(dropped off bottom)' : ''} --\n\n`;
					messageTab = 'Run I/O';
				} else if (result.reason === Simulator.NORMAL_TERMINATION) {
					messages += '\nGo: execution completed successfully.\n\n';
					runIO += '\n-- program is finished running --\n\n';
					messageTab = 'Run I/O';
				} else if (result.reason === Simulator.CLIFF_TERMINATION) {
					messages += '\nGo: execution terminated by null instruction.\n\n';
					runIO += '\n-- program is finished running (dropped off bottom) --\n\n';
					messageTab = 'Run I/O';
				} else if (result.reason === Simulator.PAUSE_OR_STOP) {
					messages += '\nGo: execution terminated by user.\n\n';
					messageTab = 'Mars Messages';
				}
			} else if (command === 'go' && result.status === 'paused') {
				messages += `Go: execution paused ${result.reason === Simulator.BREAKPOINT ? 'at breakpoint' : 'by user'}: ${filename}\n\n`;
				messageTab = 'Mars Messages';
			}
		} catch (error) {
			report(error);
		}
	}
	const tools = [
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

	function enabled(action: Action): boolean {
		// History and program ownership mutate inside the raw engine; subscribe before short-circuiting.
		void execution?.revision;
		if (action.unavailable) return false;
		if (action.command === 'assemble') return !!current && !running;
		if (['pause', 'stop'].includes(action.command)) return running;
		if (['go', 'step'].includes(action.command))
			return execution?.status === 'assembled' || execution?.status === 'paused';
		if (action.command === 'backstep')
			return (
				!!machine?.program?.getBackStepper() &&
				!machine.program.getBackStepper()!.empty() &&
				!running &&
				execution?.status !== 'idle'
			);
		if (action.command === 'reset') return !!execution?.statements.length && !running;
		if (['clearBreakpoints', 'toggleBreakpoints'].includes(action.command))
			return breakpoints.length > 0 && !running;
		if (running && !['help', 'about', 'copy'].includes(action.command)) return false;
		if (['new', 'open', 'import', 'autoSave', 'help', 'about', 'exit'].includes(action.command))
			return true;
		if (action.command === 'exportAll') return tabs.length >= 2;
		if (!current) return false;
		if (action.command === 'undo') return current.undo.length > 0;
		if (action.command === 'redo') return current.redo.length > 0;
		return true;
	}
	function refresh(commit = false) {
		revision++;
		if (ready && autoSave && commit) {
			const changed = editor.getEditPanes().filter((tab) => editor.isDirty(tab));
			if (changed.length) {
				try {
					libraryFiles = sourceLibrary.saveMany(
						changed.map((tab) => ({ name: tab.name, source: tab.text }))
					);
					for (const tab of changed) editor.markSaved(tab.id, tab.name);
					autoSaveError = '';
				} catch (error) {
					autoSaveError = `Auto Save failed: ${error instanceof Error ? error.message : String(error)}. Changes remain uncommitted.`;
				}
			}
		}
		if (ready && workspaceWritable) {
			try {
				sourceLibrary.saveWorkspace(
					editor.getEditPanes().map((tab) => ({
						name: tab.name,
						source: tab.text,
						savedSource: tab.savedText,
						isNew: tab.isNew,
						selected: tab.id === editor.getCurrentEditTab()?.id
					}))
				);
				backupError = '';
			} catch (error) {
				backupError = `Source backup failed: ${error instanceof Error ? error.message : String(error)}. Keep this tab open or export your work.`;
			}
		}
	}
	function select(id: number) {
		editor.setCurrentEditTab(id);
		selectionStart = 0;
		selectionEnd = 0;
		refresh();
	}
	function edit(text: string) {
		editor.setText(text);
		controller?.invalidate();
		refresh(true);
	}
	function sourceKeydown(event: KeyboardEvent) {
		sourceHelp = null;
		// JEditTextArea only intercepts unmodified Tab; insert_tab replaces the selection
		// with one literal tab. Shift+Tab remains available for keyboard focus traversal.
		if (event.key !== 'Tab' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)
			return;
		const input = event.currentTarget;
		if (!(input instanceof HTMLTextAreaElement)) return;
		event.preventDefault();
		input.setRangeText('\t', input.selectionStart, input.selectionEnd, 'end');
		edit(input.value);
		selection();
	}
	function hoverSource(event: PointerEvent) {
		if (!current || !machine || event.buttons) {
			sourceHelp = null;
			return;
		}
		// Hit-test the painted tokens under the native textarea, preserving its selection behavior.
		const surface = (event.currentTarget as HTMLTextAreaElement).parentElement;
		for (const node of surface?.querySelectorAll<HTMLElement>('[data-help-start]') ?? []) {
			const rect = node.getBoundingClientRect();
			if (
				event.clientX < rect.left ||
				event.clientX >= rect.right ||
				event.clientY < rect.top ||
				event.clientY >= rect.bottom
			)
				continue;
			const start = Number(node.dataset.helpStart);
			if (visibleSourceHelp?.start === start) return;
			const span = highlighted.find((entry) => entry.start === start);
			if (!span) break;
			const directive = span.id === Token.KEYWORD2 ? Directives.matchDirective(span.text) : null;
			const entries = directive
				? [{ example: directive.getName(), description: directive.getDescription() }]
				: (machine.instructionSet.matchOperator(span.text) ?? []).map((instruction) => ({
						example: instruction.getExampleFormat(),
						description: instruction.getDescription()
					}));
			if (!entries.length) break;
			const above = window.innerHeight - rect.bottom < 260;
			sourceHelp = {
				buffer: current.id,
				source: current.text,
				start,
				entries,
				above,
				left: Math.max(8, Math.min(rect.left, window.innerWidth - 528)),
				edge: above ? window.innerHeight - rect.top : rect.bottom
			};
			return;
		}
		sourceHelp = null;
	}
	function leaveSource(event: PointerEvent) {
		if (!(event.relatedTarget instanceof Element) || !event.relatedTarget.closest('.source-help'))
			sourceHelp = null;
	}
	function selection() {
		selectionStart = sourceInput?.selectionStart ?? 0;
		selectionEnd = sourceInput?.selectionEnd ?? 0;
	}
	function dismiss() {
		modal = null;
		closeQueue = [];
		saveQueue = [];
		closingAfterSave = false;
		renameSource = false;
		fileError = '';
		replaceSave = false;
		importSources = [];
	}
	function report(error: unknown) {
		messages += `${error instanceof ProcessingException ? (error.errors()?.generateErrorAndWarningReport() ?? '') : error instanceof Error ? error.message : String(error)}\n`;
		messageTab = 'Mars Messages';
	}
	function fileFailure(error: unknown) {
		fileError = error instanceof Error ? error.message : String(error);
		report(error);
	}
	function showOpen() {
		fileError = '';
		selectedSources = [];
		modal = 'open';
		try {
			libraryFiles = sourceLibrary.read();
		} catch (error) {
			fileFailure(error);
		}
	}
	async function openSources(sources: readonly SavedSource[]) {
		for (const file of sources) {
			const existing = editor.getEditPanes().find((tab) => tab.name === file.name);
			if (existing) editor.setCurrentEditTab(existing.id);
			else editor.openFile(file.name, file.source);
		}
		modal = null;
		refresh();
		view = 'Edit';
		if (engineSettings[Settings.ASSEMBLE_ON_OPEN_ENABLED]) assemble();
		await tick();
		sourceInput?.focus();
	}
	function requestDelete() {
		fileError = '';
		modal = 'delete';
	}
	function cancelDelete() {
		fileError = '';
		modal = 'open';
	}
	function confirmDelete() {
		try {
			libraryFiles = sourceLibrary.delete(selectedSources);
			for (const tab of [...editor.getEditPanes()]) {
				if (selectedSources.includes(tab.name)) editor.close(tab.id);
			}
			controller?.invalidate();
			refresh();
			selectedSources = [];
			fileError = '';
			modal = 'open';
		} catch (error) {
			fileFailure(error);
		}
	}
	function confirmOpen() {
		try {
			libraryFiles = sourceLibrary.read();
			void openSources(libraryFiles.filter((file) => selectedSources.includes(file.name)));
		} catch (error) {
			fileFailure(error);
		}
	}
	async function importFiles(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		input.value = '';
		if (!files.length) return;
		fileError = '';
		importSources = [];
		try {
			const selected = await Promise.all(
				files.map(async (file) => {
					if (!/\.asm$/i.test(file.name)) throw new Error('Import accepts .asm source files.');
					return { name: sourceName(file.name), source: await file.text() };
				})
			);
			if (new Set(selected.map((file) => file.name)).size !== selected.length)
				throw new Error('The selected files contain duplicate names. Import distinct filenames.');
			importSources = selected;
			libraryFiles = sourceLibrary.read();
			modal = 'import';
			if (!importSources.some((file) => libraryFiles.some((saved) => saved.name === file.name)))
				confirmImport();
		} catch (error) {
			modal = 'import';
			fileFailure(error);
		}
	}
	function confirmImport() {
		try {
			if (running) throw new Error('Stop execution before importing sources.');
			for (const file of importSources) {
				const tab = editor.getEditPanes().find((entry) => entry.name === file.name);
				if (tab && editor.isDirty(tab))
					throw new Error(`Save or close the edited "${file.name}" before replacing it.`);
			}
			libraryFiles = sourceLibrary.saveMany(importSources);
			for (const file of importSources) {
				const tab = editor.getEditPanes().find((entry) => entry.name === file.name);
				if (tab) editor.close(tab.id);
			}
			controller?.invalidate();
			void openSources(importSources);
			importSources = [];
		} catch (error) {
			fileFailure(error);
		}
	}
	function persistSource(tab: EditPane, name: string, rename = false): boolean {
		try {
			libraryFiles = rename
				? sourceLibrary.rename(tab.name, name, tab.text)
				: sourceLibrary.save(name, tab.text);
			if (name !== tab.name) controller?.invalidate();
			editor.markSaved(tab.id, name);
			refresh();
			return true;
		} catch (error) {
			fileFailure(error);
			return false;
		}
	}
	function save(tab: EditPane, as = false) {
		renameSource = false;
		fileError = '';
		replaceSave = false;
		if (as || tab.isNew) {
			saveTarget = tab;
			filename = tab.name;
			modal = 'save';
		} else if (!persistSource(tab, tab.name)) {
			saveTarget = tab;
			filename = tab.name;
			modal = 'save';
		}
	}
	function nextSave() {
		const id = saveQueue.shift();
		if (id === undefined) return;
		const tab = editor.getEditPanes().find((pane) => pane.id === id);
		if (!tab) {
			nextSave();
			return;
		}
		select(id);
		if (tab.isNew) save(tab);
		else if (persistSource(tab, tab.name)) nextSave();
		else {
			saveQueue = [];
			saveTarget = tab;
			filename = tab.name;
			modal = 'save';
		}
	}
	function confirmSave(overwrite = false) {
		if (!saveTarget) return;
		fileError = '';
		try {
			const name = sourceName(filename);
			if (editor.getEditPanes().some((tab) => tab.id !== saveTarget?.id && tab.name === name))
				throw new Error(`"${name}" is already open. Choose another name or close that tab first.`);
			libraryFiles = sourceLibrary.read();
			if (
				!overwrite &&
				(saveTarget.isNew || name !== saveTarget.name) &&
				libraryFiles.some((file) => file.name === name)
			) {
				replaceSave = true;
				return;
			}
			if (!persistSource(saveTarget, name, renameSource && !saveTarget.isNew)) return;
			modal = null;
			replaceSave = false;
			if (closingAfterSave) {
				closingAfterSave = false;
				editor.close(saveTarget.id);
				refresh();
				nextClose();
			} else nextSave();
		} catch (error) {
			fileFailure(error);
		}
	}
	function exportSources(all = false) {
		try {
			const sources: SavedSource[] = all ? sourceLibrary.read() : [];
			for (const tab of all ? editor.getEditPanes() : current ? [current] : []) {
				const index = sources.findIndex((file) => file.name === tab.name);
				if (index < 0) sources.push({ name: tab.name, source: tab.text });
				else sources[index] = { name: tab.name, source: tab.text };
			}
			// eslint-disable-next-line svelte/prefer-svelte-reactivity -- Export filenames are transient bookkeeping, never rendered state.
			const names = new Set<string>();
			for (const file of sources) {
				const stem = file.name
					.split('/')
					.at(-1)!
					.replace(/\.[^.]+$/, '');
				let name = `${stem}.asm`,
					suffix = 2;
				while (names.has(name)) name = `${stem}-${suffix++}.asm`;
				names.add(name);
				downloadSource(name, file.source);
			}
		} catch (error) {
			fileFailure(error);
		}
	}
	function nextClose() {
		const id = closeQueue.shift();
		if (id === undefined) {
			modal = null;
			return;
		}
		const tab = editor.getEditPanes().find((pane) => pane.id === id);
		if (!tab) return nextClose();
		select(id);
		if (editor.isDirty(tab)) {
			modal = 'close';
			return;
		}
		editor.close(id);
		refresh();
		nextClose();
	}
	function startClose(ids: number[]) {
		closeQueue = ids;
		nextClose();
	}
	function discard() {
		if (current) editor.close(current.id);
		refresh();
		nextClose();
	}
	function saveAndClose() {
		if (!current) return;
		if (current.isNew) {
			closingAfterSave = true;
			save(current);
		} else if (persistSource(current, current.name)) {
			editor.close(current.id);
			refresh();
			nextClose();
		}
	}
	async function clipboard(command: string) {
		if (!current) return;
		try {
			if (command === 'paste') {
				const tab = current,
					start = selectionStart,
					end = selectionEnd;
				const text = await navigator.clipboard.readText();
				if (current !== tab) return;
				edit(tab.text.slice(0, start) + text + tab.text.slice(end));
			} else {
				const tab = current,
					start = selectionStart,
					end = selectionEnd;
				await navigator.clipboard.writeText(tab.text.slice(start, end));
				if (command === 'cut' && current === tab)
					edit(tab.text.slice(0, start) + tab.text.slice(end));
			}
		} catch {
			report(
				'Clipboard access was denied. Use the browser’s Cut, Copy, and Paste keyboard shortcuts.'
			);
		}
	}
	async function action(command: string) {
		document.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((menu) => {
			menu.open = false;
		});
		if ([...runActions, ...breakpointActions].some((entry) => entry.command === command)) {
			await runCommand(command);
			return;
		}
		switch (command) {
			case 'new':
				try {
					libraryFiles = sourceLibrary.read();
				} catch (error) {
					fileFailure(error);
				}
				editor.newFile(libraryFiles.map((file) => file.name));
				refresh(true);
				view = 'Edit';
				await tick();
				sourceInput?.focus();
				break;
			case 'open':
				showOpen();
				break;
			case 'autoSave':
				autoSave = !autoSave;
				autoSaveError = '';
				refresh(true);
				break;
			case 'import':
				fileInput.click();
				break;
			case 'export':
				exportSources();
				break;
			case 'exportAll':
				exportSources(true);
				break;
			case 'close':
				if (current) startClose([current.id]);
				break;
			case 'closeAll':
			case 'exit':
				startClose(tabs.map((tab) => tab.id));
				break;
			case 'save':
				if (current) save(current);
				break;
			case 'saveAs':
				if (current) save(current, true);
				break;
			case 'saveAll':
				saveQueue = tabs.map((tab) => tab.id);
				nextSave();
				break;
			case 'undo':
				editor.undo();
				controller?.invalidate();
				refresh(true);
				break;
			case 'redo':
				editor.redo();
				controller?.invalidate();
				refresh(true);
				break;
			case 'cut':
			case 'copy':
			case 'paste':
				await clipboard(command);
				break;
			case 'selectAll':
				sourceInput?.focus();
				sourceInput?.select();
				selection();
				break;
			case 'find':
				findStatus = '';
				modal = 'find';
				break;
			case 'help':
				modal = 'help';
				break;
			case 'about':
				modal = 'about';
				break;
		}
	}
	async function findNext() {
		if (!current || !findText) return;
		const text = caseSensitive ? current.text : current.text.toLowerCase();
		const query = caseSensitive ? findText : findText.toLowerCase();
		let index = text.indexOf(query, selectionEnd);
		if (index < 0) index = text.indexOf(query);
		if (index < 0) {
			findStatus = 'Text not found.';
			return;
		}
		selectionStart = index;
		selectionEnd = index + findText.length;
		await tick();
		sourceInput?.setSelectionRange(selectionStart, selectionEnd);
		findStatus = `Match at character ${index + 1}.`;
	}
	function replace(all = false) {
		if (!current || !findText) return;
		const query = caseSensitive ? findText : findText.toLowerCase();
		if (!all) {
			const selected = current.text.slice(selectionStart, selectionEnd);
			if ((caseSensitive ? selected : selected.toLowerCase()) === query) {
				edit(
					current.text.slice(0, selectionStart) + replacement + current.text.slice(selectionEnd)
				);
				selectionEnd = selectionStart + replacement.length;
			}
			void findNext();
			return;
		}
		const source = current.text,
			comparable = caseSensitive ? source : source.toLowerCase();
		let output = '',
			offset = 0,
			count = 0,
			index = comparable.indexOf(query);
		while (index >= 0) {
			output += source.slice(offset, index) + replacement;
			offset = index + findText.length;
			count++;
			index = comparable.indexOf(query, offset);
		}
		edit(output + source.slice(offset));
		findStatus = `${count} occurrence(s) replaced.`;
	}
	function captureNewFile(event: KeyboardEvent) {
		if (
			!event.altKey ||
			event.ctrlKey ||
			event.metaKey ||
			(event.code !== 'KeyN' && event.key.toLowerCase() !== 'n') ||
			event.shiftKey ||
			event.isComposing ||
			event.getModifierState('AltGraph')
		)
			return;
		// Capture before focused inputs handle the shortcut. Option+N can report a Dead key
		// on macOS, so match its physical code and prevent accent composition as well.
		event.preventDefault();
		event.stopPropagation();
		if (ready && !modal && !running && !event.repeat) void action('new');
	}
	function keydown(event: KeyboardEvent) {
		if (event.key === 'Escape') sourceHelp = null;
		if (modal || (event.target instanceof HTMLInputElement && event.target !== fileInput)) return;
		if (event.key === 'Escape') {
			document.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((menu) => {
				menu.open = false;
			});
			return;
		}
		let command: string | undefined;
		if (event.ctrlKey || event.metaKey)
			command = (
				{
					o: 'open',
					s: event.shiftKey ? 'saveAs' : 'save',
					f: 'find',
					z: event.shiftKey ? 'redo' : 'undo',
					y: 'redo'
				} as Record<string, string>
			)[event.key.toLowerCase()];
		if (event.key === 'F1') command = 'help';
		command ??= runActions.find((entry) => entry.shortcut === event.key)?.command;
		const item = [...fileActions, ...editActions, ...helpActions, ...runActions].find(
			(entry) => entry.command === command
		);
		if (command && item && enabled(item)) {
			event.preventDefault();
			void action(command);
		}
	}
	function persistPaneLayout() {
		if (ready) savePaneLayout({ registerWidth: displayedRegisterWidth, editorFraction });
	}
	function setEditorHeight(height: number) {
		editorFraction = Math.max(150, Math.min(maxEditorHeight, height)) / Math.max(1, leftPaneHeight);
	}
	function beginEditorResize(event: PointerEvent) {
		if (event.button !== 0) return;
		const handle = event.currentTarget as HTMLElement;
		handle.setPointerCapture(event.pointerId);
		handle.focus();
		editorResizeDrag = {
			pointer: event.pointerId,
			startY: event.clientY,
			height: displayedEditorHeight
		};
		event.preventDefault();
	}
	function moveEditorResize(event: PointerEvent) {
		if (editorResizeDrag?.pointer === event.pointerId)
			setEditorHeight(editorResizeDrag.height + event.clientY - editorResizeDrag.startY);
	}
	function endEditorResize(event: PointerEvent) {
		if (editorResizeDrag?.pointer === event.pointerId) {
			editorResizeDrag = undefined;
			persistPaneLayout();
		}
	}
	function keyEditorResize(event: KeyboardEvent) {
		const heights: Record<string, number> = {
			ArrowUp: displayedEditorHeight - 10,
			ArrowDown: displayedEditorHeight + 10,
			Home: 150,
			End: maxEditorHeight
		};
		if (event.key in heights) {
			event.preventDefault();
			setEditorHeight(heights[event.key]);
			persistPaneLayout();
		}
	}
	function clampRegisterWidth(width: number) {
		return Math.round(Math.max(260, Math.min(maxRegisterWidth, width)));
	}
	function beginRegisterResize(event: PointerEvent) {
		if (event.button !== 0) return;
		const handle = event.currentTarget as HTMLElement;
		handle.setPointerCapture(event.pointerId);
		handle.focus();
		resizeDrag = { pointer: event.pointerId, startX: event.clientX, width: displayedRegisterWidth };
		event.preventDefault();
	}
	function moveRegisterResize(event: PointerEvent) {
		if (resizeDrag?.pointer === event.pointerId)
			registerWidth = clampRegisterWidth(resizeDrag.width + resizeDrag.startX - event.clientX);
	}
	function endRegisterResize(event: PointerEvent) {
		if (resizeDrag?.pointer === event.pointerId) {
			resizeDrag = undefined;
			persistPaneLayout();
		}
	}
	function keyRegisterResize(event: KeyboardEvent) {
		const widths: Record<string, number> = {
			ArrowLeft: displayedRegisterWidth + 10,
			ArrowRight: displayedRegisterWidth - 10,
			Home: 260,
			End: maxRegisterWidth
		};
		if (event.key in widths) {
			event.preventDefault();
			registerWidth = clampRegisterWidth(widths[event.key]);
			persistPaneLayout();
		}
	}
	function closeMenusOutside(event: MouseEvent) {
		const target = event.target;
		if (!(target instanceof Node)) return;
		document.querySelectorAll<HTMLDetailsElement>('.menubar details[open]').forEach((menu) => {
			if (!menu.contains(target)) menu.open = false;
		});
	}
	function beforeUnload(event: BeforeUnloadEvent) {
		if (tabs.some((tab) => editor.isDirty(tab))) event.preventDefault();
	}
</script>

<!-- @component Session-owned Venus desktop connected to the translated assembler, simulator, and debugger. -->
<svelte:head
	><title>{current ? `${editor.isDirty(current) ? '* ' : ''}${current.name} - ` : ''}MARS</title
	><meta name="description" content="MARS MIPS assembler and runtime simulator" /></svelte:head
>
<pre class="print-source">{current?.text ?? ''}</pre>
<svelte:document onclick={closeMenusOutside} />
<svelte:window
	onkeydowncapture={captureNewFile}
	onkeydown={keydown}
	onbeforeunload={beforeUnload}
/>
{#if !desktopVisible}
	<div class="loading-screen" role="status">
		<span class="loading-spinner" aria-hidden="true"></span>
		<span>Loading MARS…</span>
	</div>
{/if}
<fieldset
	disabled={!desktopVisible}
	class="application-controls"
	class:initializing={!desktopVisible}
	aria-busy={!desktopVisible}
>
	<input
		class="hidden"
		type="file"
		multiple
		accept=".asm"
		bind:this={fileInput}
		onchange={importFiles}
		aria-label="Import assembly files"
	/>
	<div class="desktop flex h-dvh min-h-[480px] flex-col overflow-hidden text-[12px]">
		{#if backupError || autoSaveError}<p class="backup-error" role="alert">
				{backupError || autoSaveError}
			</p>{/if}
		<nav class="menubar" aria-label="Application menus">
			{#each menus as menu (menu.name)}<details name="menus">
					<summary>{menu.name}</summary>
					<div class="menu">
						{#each menu.actions as item (item.command)}<button
								disabled={!enabled(item)}
								onclick={() => action(item.command)}
								><span>{item.label}</span><kbd>{item.shortcut ?? ''}</kbd></button
							>{/each}
					</div>
				</details>{/each}
			<details name="menus">
				<summary>Settings</summary>
				<div class="menu settings-menu">
					{#each engineOptions.filter((option) => option !== popupInputOption) as option (option.id)}<label
							><input
								type="checkbox"
								checked={engineSettings[option.id] ?? false}
								disabled={running}
								onchange={(event) => updateEngineSetting(option.id, event.currentTarget.checked)}
							/>
							{option.label}</label
						>{/each}
					{#each pendingSettings as setting (setting)}<button disabled>{setting}</button>{/each}
				</div>
			</details>
			<details name="menus">
				<summary>Tools</summary>
				<div class="menu">
					{#each tools as tool (tool)}<button disabled>{tool}</button>{/each}
				</div>
			</details>
			<details name="menus">
				<summary>Help</summary>
				<div class="menu">
					{#each helpActions as item (item.command)}<button onclick={() => action(item.command)}
							>{item.label}</button
						>{/each}
				</div>
			</details>
			<ThemeToggle />
		</nav>
		<div class="toolbar" aria-label="Toolbar">
			{#each [fileActions.filter((item) => item.icon || item.debugIcon), editActions.filter((item) => item.icon), [...runActions, ...breakpointActions].filter((item) => item.debugIcon)] as group, groupIndex (groupIndex)}
				<div class="toolgroup">
					{#each group as item (item.command)}<button
							title={item.unavailable
								? `${item.label} — not yet available`
								: `${item.label}${item.shortcut ? ` (${item.shortcut})` : ''}`}
							aria-label={item.label}
							aria-pressed={item.command === 'toggleBreakpoints'
								? breakpointsEnabled
								: item.command === 'autoSave'
									? autoSave
									: undefined}
							disabled={!enabled(item)}
							onclick={() => action(item.command)}
							>{#if item.debugIcon}<ToolbarIcon
									name={item.debugIcon === 'breakpoints' && !breakpointsEnabled
										? 'breakpointsDisabled'
										: item.debugIcon}
								/>{:else}<img
									src={icons[item.icon ?? '']}
									alt=""
									width="22"
									height="22"
								/>{/if}</button
						>{/each}
				</div>
			{/each}
			<div class="toolgroup view-toggles" role="group" aria-label="Display settings">
				{#each displayToggles as toggle (toggle.icon)}
					<button
						title={toggle.label}
						aria-label={toggle.label}
						aria-pressed={toggle.active}
						disabled={toggle.disabled}
						onclick={toggle.toggle}><ToolbarIcon name={toggle.icon} /></button
					>
				{/each}
			</div>
			<div class="toolgroup">
				<button title="Help (F1)" aria-label="Help" onclick={() => action('help')}>
					<img src={icons.Help} alt="" width="22" height="22" />
				</button>
			</div>
			<label class="speed"
				>Run speed {runSpeed}<input
					type="range"
					min="0"
					max="40"
					step="1"
					bind:value={speed}
					aria-label="Run speed"
				/></label
			>
		</div>
		<main
			class="workspace"
			bind:clientWidth={workspaceWidth}
			style:--register-width={`${displayedRegisterWidth}px`}
		>
			<div
				class="left-panes"
				bind:clientHeight={leftPaneHeight}
				style:--editor-height={`${displayedEditorHeight}px`}
			>
				<section id={`${paneId}-editor`} class="main-pane" aria-label="Source and execution">
					<div class="tabs">
						{#each ['Edit', 'Execute'] as tab (tab)}<button
								class:active={view === tab}
								aria-pressed={view === tab}
								onclick={() => (view = tab)}>{tab}</button
							>{/each}
					</div>
					{#if view === 'Edit'}
						<div class="source-tabs">
							{#each tabs as tab (tab.id)}<div class:active={current?.id === tab.id}>
									<button onclick={() => select(tab.id)}
										>{editor.isDirty(tab) ? '* ' : ''}{tab.name}</button
									><button aria-label={`Close ${tab.name}`} onclick={() => startClose([tab.id])}
										>×</button
									>
								</div>{/each}
						</div>
						{#if current}<div
								class="editor-area"
								style:--editor-font={editorPreset.font}
								style:--editor-tab-size={editorPreset.tabSize}
								style:--editor-caret={`var(--theme-text, ${editorPreset.caretColor})`}
								style:--editor-selection={`var(--theme-selection, ${editorPreset.selectionBackground})`}
							>
								{#if showLines}<div class="line-numbers" aria-hidden="true">
										<pre style:transform={`translateY(${-scrollTop}px)`}>{Array.from(
												{ length: current.text.split('\n').length },
												(_, i) => i + 1
											).join('\n')}</pre>
									</div>{/if}
								<div class="source-surface">
									<pre
										class="syntax-layer"
										aria-hidden="true"
										style:transform={`translate(${-scrollLeft}px, ${-scrollTop}px)`}>{#each highlighted as span (span.start)}<span
												data-token={span.id}
												data-help-start={span.id === Token.KEYWORD1 || span.id === Token.KEYWORD2
													? span.start
													: undefined}
												style:color={`var(--theme-syntax-${span.id}, ${syntaxStyles[span.id].color})`}
												style:font-style={syntaxStyles[span.id].italic ? 'italic' : 'normal'}
												style:font-weight={syntaxStyles[span.id].bold ? 'bold' : 'normal'}
												>{span.text}</span
											>{/each}&#10;</pre>
									<textarea
										bind:this={sourceInput}
										aria-label={`Source ${current.name}`}
										aria-describedby={visibleSourceHelp ? `${paneId}-source-help` : undefined}
										value={current.text}
										readonly={running}
										oninput={(event) => {
											edit(event.currentTarget.value);
											selection();
										}}
										onclick={selection}
										onpointermove={hoverSource}
										onpointerleave={leaveSource}
										onpointerdown={() => (sourceHelp = null)}
										onblur={() => (sourceHelp = null)}
										onkeydown={sourceKeydown}
										onkeyup={selection}
										onselect={selection}
										onscroll={(event) => {
											sourceHelp = null;
											scrollTop = event.currentTarget.scrollTop;
											scrollLeft = event.currentTarget.scrollLeft;
										}}
										spellcheck="false"
										autocapitalize="off"
										autocomplete="off"
										wrap="off"></textarea>
									{#if visibleSourceHelp && !modal}
										<div
											id={`${paneId}-source-help`}
											class="source-help"
											role="tooltip"
											style:left={`${visibleSourceHelp.left}px`}
											style:top={visibleSourceHelp.above
												? undefined
												: `${visibleSourceHelp.edge}px`}
											style:bottom={visibleSourceHelp.above
												? `${visibleSourceHelp.edge}px`
												: undefined}
											onpointerleave={() => (sourceHelp = null)}
										>
											{#each visibleSourceHelp.entries as entry (entry.example)}
												<p><code>{entry.example}</code><br />{entry.description}</p>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						{:else}<div class="empty-editor"></div>{/if}
					{:else}
						{#if machine && execution}<ExecutePane
								{machine}
								snapshot={execution}
								{breakpoints}
								ontogglebreakpoint={toggleBreakpoint}
								onedit={() => controller?.refresh()}
								onsource={showSource}
								{showLabels}
								bind:showDataLabels
								bind:showTextLabels
								bind:labelSortState
								bind:ascii
								bind:hexAddresses
								bind:hexValues
							/>{/if}
					{/if}
				</section>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (WAI-ARIA focusable separators are adjustable widgets with keyboard interaction.) -->
				<div
					class="editor-divider"
					role="separator"
					aria-label="Editor area height"
					aria-controls={`${paneId}-editor`}
					aria-orientation="horizontal"
					aria-valuemin="150"
					aria-valuemax={maxEditorHeight}
					aria-valuenow={displayedEditorHeight}
					tabindex="0"
					onpointerdown={beginEditorResize}
					onpointermove={moveEditorResize}
					onpointerup={endEditorResize}
					onpointercancel={endEditorResize}
					onkeydown={keyEditorResize}
				></div>
				<section class="messages" aria-label="Messages and console">
					<div class="tabs">
						{#each ['Mars Messages', 'Run I/O'] as tab (tab)}<button
								class:active={messageTab === tab}
								aria-pressed={messageTab === tab}
								onclick={() => (messageTab = tab)}>{tab}</button
							>{/each}<button
							class="clear"
							onclick={() => {
								if (messageTab === 'Mars Messages') messages = '';
								else runIO = '';
							}}>Clear</button
						>
						<button
							class="clear-all"
							title="Clear Mars Messages and Run I/O"
							onclick={() => {
								messages = '';
								runIO = '';
							}}>Clear All</button
						>
					</div>
					<textarea
						readonly
						aria-label={messageTab}
						value={messageTab === 'Mars Messages' ? messages : runIO}></textarea>
					{#if inputRequest && inputRequest.prompt === null && messageTab === 'Run I/O'}<form
							class="console-input"
							onsubmit={(event) => {
								event.preventDefault();
								completeInput(true);
							}}
						>
							<label
								>Input <textarea
									{@attach focusInput}
									aria-label="Run input"
									rows="1"
									value={inputText}
									oninput={consoleInputChanged}></textarea></label
							><button type="submit">Submit</button><button
								type="button"
								onclick={() => controller?.stop()}>Stop</button
							>
						</form>{/if}
				</section>
			</div>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (WAI-ARIA focusable separators are adjustable widgets with keyboard interaction.) -->
			<div
				class="register-divider"
				role="separator"
				aria-label="Register panel width"
				aria-controls={`${paneId}-registers`}
				aria-orientation="vertical"
				aria-valuemin="260"
				aria-valuemax={maxRegisterWidth}
				aria-valuenow={displayedRegisterWidth}
				tabindex="0"
				onpointerdown={beginRegisterResize}
				onpointermove={moveRegisterResize}
				onpointerup={endRegisterResize}
				onpointercancel={endRegisterResize}
				onkeydown={keyRegisterResize}
			></div>
			{#if machine}<RegistersPane
					{hexValues}
					id={`${paneId}-registers`}
					bind:selected={registerTab}
					registers={machine.registerFile}
					coprocessor0={machine.coprocessor0}
					coprocessor1={machine.coprocessor1}
					machineRevision={execution?.revision ?? 0}
					{running}
					onedit={() => controller?.refresh()}
				/>{/if}
		</main>
		<footer>
			<span>{current?.name ?? 'No file open'}</span><span
				>{view === 'Edit' && current
					? `Line ${position.line}, Column ${position.column}`
					: ''}</span
			><span aria-label="Execution status"
				>{execution?.status ?? 'idle'}{!breakpointsEnabled ? ' — breakpoints suspended' : ''}</span
			>
		</footer>
	</div>
</fieldset>
{#if inputRequest?.prompt}<Modal title="Run Input" onclose={() => controller?.stop()}
		><form
			onsubmit={(event) => {
				event.preventDefault();
				completeInput(true);
			}}
		>
			<p>{inputRequest.prompt}</p>
			<label class="form-field"
				>Value<input
					{@attach focusInput}
					aria-label="Syscall input"
					bind:value={inputText}
				/></label
			>
			<div class="dialog-buttons">
				<button type="submit">OK</button><button type="button" onclick={() => controller?.stop()}
					>Cancel</button
				>
			</div>
		</form></Modal
	>{/if}
{#if modal === 'open'}<Modal title="Open" onclose={dismiss}>
		<form
			onsubmit={(event) => {
				event.preventDefault();
				confirmOpen();
			}}
		>
			<p>Source files stored in this browser</p>
			<div class="source-files">
				{#each libraryFiles as file (file.name)}
					<label
						><input type="checkbox" bind:group={selectedSources} value={file.name} />
						{file.name}</label
					>
				{:else}<p>No saved files yet. Create a source or import .asm files.</p>{/each}
			</div>
			{#if fileError}<p role="alert">{fileError}</p>{/if}
			<div class="dialog-buttons">
				<button type="submit" disabled={!selectedSources.length || !!fileError}>Open</button>
				<button
					type="button"
					disabled={!selectedSources.length || !!fileError}
					onclick={requestDelete}>Delete</button
				><button type="button" onclick={dismiss}>Cancel</button>
			</div>
		</form>
	</Modal>
{:else if modal === 'delete'}<Modal title="Delete sources?" onclose={cancelDelete}>
		<p>Delete these saved sources and close their open editor buffers? This cannot be undone.</p>
		{#if tabs.some((tab) => selectedSources.includes(tab.name) && editor.isDirty(tab))}<p
				role="alert"
			>
				Selected files have unsaved edits. Deleting these files will also discard those edits.
			</p>{/if}
		<ul>
			{#each selectedSources as name (name)}<li>
					{name}{#if tabs.some((tab) => tab.name === name && editor.isDirty(tab))}
						— unsaved edits will also be deleted{/if}
				</li>{/each}
		</ul>
		{#if fileError}<p role="alert">{fileError}</p>{/if}
		<div class="dialog-buttons">
			<button onclick={confirmDelete}>Delete</button><button onclick={cancelDelete}>Cancel</button>
		</div>
	</Modal>
{:else if modal === 'import'}<Modal title="Replace imported sources?" onclose={dismiss}>
		<p>Importing will replace saved sources with matching names:</p>
		<ul>
			{#each importSources as file (file.name)}<li>{file.name}</li>{/each}
		</ul>
		{#if fileError}<p role="alert">{fileError}</p>{/if}
		<div class="dialog-buttons">
			<button disabled={!importSources.length} onclick={confirmImport}>Replace</button><button
				onclick={dismiss}>Cancel</button
			>
		</div>
	</Modal>
{:else if modal === 'save'}{#key saveTarget?.id}<Modal title="Save As" onclose={dismiss}
			><form
				onsubmit={(event) => {
					event.preventDefault();
					confirmSave();
				}}
			>
				<label class="form-field"
					>File name<input
						bind:value={filename}
						oninput={() => {
							replaceSave = false;
							fileError = '';
						}}
						required
					/></label
				>
				{#if saveTarget && !saveTarget.isNew}
					<label><input type="checkbox" bind:checked={renameSource} /> Rename existing file</label>
					{#if renameSource}<label class="form-field"
							>Old filename<input value={saveTarget.name} readonly /></label
						>{/if}
				{/if}
				<p>Save this source in the browser’s local library.</p>
				{#if fileError}<p role="alert">{fileError}</p>{/if}
				{#if replaceSave}<p>A saved source named “{filename}” already exists.</p>
					<button type="button" onclick={() => confirmSave(true)}>Replace</button>{/if}
				<div class="dialog-buttons">
					<button type="submit">Save</button><button type="button" onclick={dismiss}>Cancel</button>
				</div>
			</form></Modal
		>
	{/key}{:else if modal === 'close'}<Modal title="Save changes?" onclose={dismiss}
		><p>Save changes to {current?.name} before closing?</p>
		{#if fileError}<p role="alert">{fileError}</p>{/if}
		<div class="dialog-buttons">
			<button onclick={saveAndClose}>Save</button><button onclick={discard}>Discard</button><button
				onclick={dismiss}>Cancel</button
			>
		</div></Modal
	>
{:else if modal === 'find'}<Modal title="Find / Replace" onclose={dismiss}
		><label class="form-field">Find<input bind:value={findText} /></label><label class="form-field"
			>Replace with<input bind:value={replacement} /></label
		><label><input type="checkbox" bind:checked={caseSensitive} /> Case sensitive</label>
		<div class="dialog-buttons">
			<button disabled={!findText} onclick={findNext}>Find Next</button><button
				disabled={!findText}
				onclick={() => replace()}>Replace</button
			><button disabled={!findText} onclick={() => replace(true)}>Replace All</button><button
				onclick={dismiss}>Close</button
			>
		</div>
		<p role="status">{findStatus}</p></Modal
	>
{:else if modal === 'help'}<Modal title="MARS Help" onclose={dismiss}
		><p>
			New creates a source file; Open selects saved files in this browser. Save commits your source
			locally, and Auto Save commits edits automatically when enabled. Open tabs and in-progress
			text are recovered after reload. Import reads .asm files from your computer; Export downloads
			copies.
		</p>
		<p>
			Registers remain visible beside Edit and Execute. Use the toolbar toggles to change value
			display and label visibility.
		</p>
		<p>
			Assemble (F3) translates the current source. Go (F5), Step (F7), Backstep (F8), Pause (F9),
			Stop (F11), and Reset (F12) control execution. Select breakpoints in Text Segment. Tools and
			memory export are deferred.
		</p>
		<div class="dialog-buttons"><button onclick={dismiss}>Close</button></div></Modal
	>
{:else if modal === 'about'}<Modal title="About MARS" onclose={dismiss}
		><h3>MARS — MIPS Assembler and Runtime Simulator</h3>
		<p>MARS-ts 1.0 development</p>
		<p>
			Original MARS: copyright © 2003–2013 Pete Sanderson and Kenneth Vollmar. Distributed under the
			MIT license.
		</p>
		<p>Mars imagery credit: NASA/JPL.</p>
		<p>
			<a href={asset('MARSlicense.txt')} target="_blank" rel="noopener noreferrer"
				>Read the MIT license (opens in a new tab)</a
			>
		</p>
		<div class="dialog-buttons"><button onclick={dismiss}>Close</button></div></Modal
	>{/if}

<style>
	.desktop {
		background: var(--theme-background, #ededed);
		color: var(--theme-text, #17202b);
	}
	.initializing {
		visibility: hidden;
	}
	.loading-screen {
		position: fixed;
		inset: 0;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 12px;
		background: var(--theme-background, #ededed);
		color: var(--theme-text, #17202b);
		font-size: 14px;
	}
	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--theme-border, #c4cbd2);
		border-top-color: var(--theme-focus, #315e88);
		border-radius: 50%;
		animation: loading-spin 0.8s linear infinite;
		will-change: transform;
	}
	@keyframes loading-spin {
		to {
			transform: rotate(360deg);
		}
	}
	.backup-error {
		padding: 6px 10px;
		color: var(--theme-error, #8b1a1a);
		background: var(--theme-warning, #fff1db);
	}
	.source-files {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-height: 120px;
		max-height: 300px;
		overflow: auto;
		margin-block: 10px;
		padding: 8px;
		border: 1px solid var(--theme-border, #94a3b8);
		background: var(--theme-canvas, white);
	}
	.editor-divider {
		height: 5px;
		flex: 0 0 5px;
		cursor: row-resize;
		touch-action: none;
		background: var(--theme-divider, #d4d9de);
		border-block: 1px solid var(--theme-border, #a8b0b8);
	}
	.editor-divider:hover,
	.editor-divider:focus-visible {
		background: var(--theme-selected-hover, #8db3d1);
		outline: 1px solid var(--theme-focus, #2c679c);
	}
	.register-divider {
		width: 5px;
		flex: 0 0 5px;
		cursor: col-resize;
		touch-action: none;
		background: var(--theme-divider, #d4d9de);
		border-inline: 1px solid var(--theme-border, #a8b0b8);
	}
	.register-divider:hover,
	.register-divider:focus-visible {
		background: var(--theme-selected-hover, #8db3d1);
		outline: 1px solid var(--theme-focus, #2c679c);
	}
	.application-controls {
		display: contents;
	}
	.source-surface {
		position: relative;
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: var(--theme-canvas, white);
	}
	.syntax-layer {
		position: absolute;
		top: 0;
		left: 0;
		margin: 0;
		padding: 5px 8px;
		pointer-events: none;
		white-space: pre;
		font: var(--editor-font);
		tab-size: var(--editor-tab-size);
		font-variant-ligatures: none;
	}
	.source-surface textarea {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		background: transparent;
		color: transparent;
		caret-color: var(--editor-caret);
		-webkit-text-fill-color: transparent;
		font-variant-ligatures: none;
	}
	.source-surface textarea::selection {
		background: var(--editor-selection);
	}
	.source-help {
		position: fixed;
		z-index: 30;
		width: max-content;
		max-width: min(520px, calc(100vw - 16px));
		max-height: min(240px, 40vh);
		overflow: auto;
		padding: 6px 9px;
		border: 1px solid var(--theme-border, #8d969e);
		background: var(--theme-tooltip, #ffffe1);
		color: var(--theme-text, #17202b);
		box-shadow: 2px 3px 8px #0003;
		font:
			12px/1.4 system-ui,
			sans-serif;
	}
	.source-help p + p {
		margin-top: 7px;
	}
	.source-help code {
		font-weight: bold;
	}
	@media (forced-colors: active) {
		.syntax-layer {
			display: none;
		}
		.source-surface textarea {
			color: CanvasText;
			-webkit-text-fill-color: CanvasText;
			caret-color: CanvasText;
		}
	}
	.menubar {
		display: flex;
		gap: 1px;
		padding: 1px 4px;
		border-bottom: 1px solid var(--theme-border, #b0b0b0);
	}
	details {
		position: relative;
	}
	summary {
		list-style: none;
		cursor: default;
		padding: 3px 10px;
	}
	summary:hover,
	details[open] > summary {
		background: var(--theme-hover, #c6dcef);
	}
	.menu {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 20;
		min-width: 230px;
		padding: 3px;
		background: var(--theme-surface, #f5f5f5);
		border: 1px solid var(--theme-border, #919191);
		box-shadow: 2px 3px 5px #0003;
	}
	.menu button,
	.menu label {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
		text-align: left;
		padding: 5px 12px;
		white-space: nowrap;
	}
	.menu button {
		justify-content: space-between;
	}
	.menu button:hover:enabled,
	.menu label:hover {
		background: var(--theme-hover, #c6dcef);
	}
	kbd {
		margin-left: 25px;
		color: var(--theme-muted, #667);
		font-size: 11px;
	}
	.toolbar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
		padding: 3px;
		border-bottom: 1px solid var(--theme-border, #999);
	}
	.toolgroup {
		display: flex;
		padding-right: 5px;
		border-right: 1px solid var(--theme-border, #aaa);
	}
	.toolgroup:last-of-type {
		border: 0;
	}
	.toolgroup button {
		width: 29px;
		height: 29px;
		display: grid;
		place-items: center;
		border: 1px solid transparent;
	}
	.toolgroup button:hover:enabled {
		border-color: var(--theme-accent-border, #849eb5);
		background: var(--theme-hover, #dbe8f2);
	}
	.toolgroup button:disabled {
		opacity: 0.35;
	}
	.toolgroup button[aria-pressed='true'] {
		background: var(--theme-selected, #c4ddef);
		border-color: var(--theme-accent-border, #648eae);
		color: var(--theme-accent-text, #164c75);
	}
	.toolgroup button[aria-pressed='true']:hover {
		background: var(--theme-selected-hover, #b1d1e8);
	}
	.speed {
		margin-left: auto;
		min-width: 170px;
		text-align: center;
		font-size: 11px;
	}
	.speed input {
		display: block;
		width: 100%;
		height: 14px;
	}
	.workspace {
		display: flex;
		flex: 1;
		min-height: 0;
		padding: 4px;
		gap: 5px;
	}
	.left-panes {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 300px;
		min-height: 0;
	}
	.main-pane {
		display: flex;
		flex-direction: column;
		height: var(--editor-height, 75%);
		flex: 0 0 auto;
		min-height: 150px;
		overflow: auto;
		border: 1px solid var(--theme-border, #8d969e);
		background: var(--theme-canvas, white);
	}
	.tabs {
		display: flex;
		flex-shrink: 0;
		background: var(--theme-chrome, #e4e4e4);
		border-bottom: 1px solid var(--theme-border, #9ca7b0);
		padding: 2px 3px 0;
		gap: 2px;
	}
	.tabs button {
		padding: 4px 12px;
		border: 1px solid var(--theme-border, #a6aeb5);
		border-bottom: 0;
		border-radius: 3px 3px 0 0;
	}
	.tabs button.active {
		background: var(--theme-canvas, white);
		font-weight: 600;
	}
	.source-tabs {
		display: flex;
		min-height: 28px;
		background: var(--theme-chrome, #e7e7e7);
		overflow-x: auto;
		flex-shrink: 0;
	}
	.source-tabs > div {
		display: flex;
		border-right: 1px solid var(--theme-border, #aaa);
	}
	.source-tabs button {
		padding: 4px 7px;
		white-space: nowrap;
	}
	.source-tabs .active {
		background: var(--theme-canvas, white);
	}
	.editor-area {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
	.line-numbers {
		overflow: hidden;
		width: 45px;
		flex-shrink: 0;
		background: var(--theme-gutter, #f1f1f1);
		border-right: 1px solid var(--theme-border, #ddd);
		text-align: right;
		padding: 5px 6px 5px 0;
		color: var(--theme-muted, #777);
	}
	.line-numbers pre,
	.editor-area textarea {
		font: var(--editor-font);
		tab-size: var(--editor-tab-size);
	}
	.editor-area textarea {
		flex: 1;
		min-width: 0;
		resize: none;
		padding: 5px 8px;
		border: 0;
		outline-offset: -2px;
		white-space: pre;
	}
	.empty-editor {
		flex: 1;
		background: var(--theme-surface, #f7f7f7);
	}
	.messages {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 80px;
		border: 1px solid var(--theme-border, #8d969e);
	}
	.messages textarea {
		flex: 1;
		min-height: 0;
		background: var(--theme-canvas, white);
		padding: 6px;
		resize: none;
		font: 13px/1.4 monospace;
	}
	.tabs .clear {
		margin-left: auto;
	}
	.tabs .clear,
	.tabs .clear-all {
		border: 1px solid var(--theme-border, #aaa);
		padding: 1px 12px;
		margin-bottom: 2px;
		border-radius: 0;
	}
	.console-input {
		display: flex;
		gap: 8px;
		padding: 4px 6px;
		background: var(--theme-chrome, #eee);
	}
	.console-input label {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 8px;
	}
	.console-input textarea {
		flex: 1;
		min-width: 0;
		min-height: 26px;
		border: 1px solid var(--theme-border, #aaa);
		background: var(--theme-canvas, white);
		resize: none;
	}
	.console-input button {
		padding: 2px 8px;
		border: 1px solid var(--theme-border, #aaa);
	}
	footer {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 2px 8px;
		border-top: 1px solid var(--theme-border, #aaa);
		font-size: 11px;
	}
	.form-field {
		display: grid;
		grid-template-columns: 100px 1fr;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
	}
	.form-field input {
		padding: 4px;
		border: 1px solid var(--theme-border, #9a9a9a);
		background: var(--theme-canvas, white);
	}
	.dialog-buttons {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 16px;
	}
	.dialog-buttons button {
		border: 1px solid var(--theme-border, #929eaa);
		background: var(--theme-surface, #f8f8f8);
		padding: 4px 13px;
	}
	p {
		margin: 8px 0;
	}
	h3 {
		font-weight: 600;
	}
	a {
		text-decoration: underline;
		color: var(--theme-accent-text, #225888);
	}
	.print-source {
		display: none;
	}
	@media print {
		.print-source {
			display: block;
			white-space: pre-wrap;
			font: 12px monospace;
		}
		.menubar,
		.toolbar,
		.messages,
		footer,
		.tabs,
		.source-tabs {
			display: none;
		}
		.desktop {
			display: none;
		}
		.main-pane {
			height: auto;
			border: 0;
			resize: none;
		}
		.editor-area textarea {
			height: auto;
		}
	}
</style>
