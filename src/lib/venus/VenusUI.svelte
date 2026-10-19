<script lang="ts">
	/**
	 * Ports the layout/action responsibilities of mars/venus/VenusUI.java, MainPane.java,
	 * MessagesPane.java, ExecutePane.java, and RunSpeedPanel.java.
	 * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
	 */
	import { asset } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { highlightSource } from '#lib/editor/highlighting/MIPSTokenMarker.js';
	import editorPreset from '#lib/editor/editor-preset.json';
	import { loadPaneLayout, savePaneLayout } from '#lib/browser/PaneLayout.js';
	import { loadDisplaySettings, saveDisplaySettings } from '#lib/browser/DisplaySettings.js';
	import { Editor, type EditPane } from '#lib/editor/Editor.js';
	import { downloadSource } from '#lib/browser/download.js';
	import Modal from './Modal.svelte';
	import RegistersPane from './RegistersPane.svelte';
	import ExecutePane from './ExecutePane.svelte';
	import { Globals } from '#lib/engine/Globals.js';
	import { ProcessingException } from '#lib/engine/diagnostics/ProcessingException.js';
	import { Settings } from '#lib/engine/Settings.js';
	import type { InputRequest } from '#lib/engine/io/SystemIO.js';
	import { Simulator } from '#lib/engine/simulator/Simulator.js';
	import { RunController } from './RunController.js';

	const icons: Record<string, string> = {
		Previous: asset('icons/Previous.svg'),
		Paste: asset('icons/Paste.svg'),
		Pause: asset('icons/Pause.svg'),
		Assemble: asset('icons/Assemble.svg'),
		Redo: asset('icons/Redo.svg'),
		StepForward: asset('icons/StepForward.svg'),
		Next: asset('icons/Next.svg'),
		StepBack: asset('icons/StepBack.svg'),
		Play: asset('icons/Play.svg'),
		Open: asset('icons/Open.svg'),
		Dump: asset('icons/Dump.svg'),
		Help: asset('icons/Help.svg'),
		Find: asset('icons/Find.svg'),
		Stop: asset('icons/Stop.svg'),
		SaveAs: asset('icons/SaveAs.svg'),
		New: asset('icons/New.svg'),
		Undo: asset('icons/Undo.svg'),
		Reset: asset('icons/Reset.svg'),
		Save: asset('icons/Save.svg'),
		Print: asset('icons/Print.svg'),
		Copy: asset('icons/Copy.svg'),
		Cut: asset('icons/Cut.svg')
	};
	const paneId = $props.id();
	let ready = $state(false);
	onMount(() => {
		const layout = loadPaneLayout();
		if (layout) {
			registerWidth = layout.registerWidth;
			editorFraction = layout.editorFraction;
		}
		const settings = loadDisplaySettings();
		if (settings) {
			showLabels = settings.showLabels;
			showLines = settings.showLines;
			hexValues = settings.hexValues;
			hexAddresses = settings.hexAddresses;
			speed = settings.speed;
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
				if (!tab) throw new Error(`Source file "${name}" is not open in the editor.`);
				return tab.text;
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
		return () => {
			disposed = true;
			release();
			void controls.dispose().finally(wake);
		};
	});
	$effect(() => {
		if (ready) saveDisplaySettings({ showLabels, showLines, hexValues, hexAddresses, speed });
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
	let view = $state('Edit');
	let registerTab = $state('Registers');
	let messageTab = $state('Mars Messages');
	let messages = $state('');
	let runIO = $state('');
	let modal = $state<'save' | 'close' | 'find' | 'help' | 'about' | null>(null);
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
	let showLines = $state(true);
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
		command: string;
		shortcut?: string;
		unavailable?: boolean;
	};
	const fileActions: Action[] = [
		{ label: 'New', icon: 'New', command: 'new', shortcut: 'Ctrl+N' },
		{ label: 'Open ...', icon: 'Open', command: 'open', shortcut: 'Ctrl+O' },
		{ label: 'Close', command: 'close' },
		{ label: 'Close All', command: 'closeAll' },
		{ label: 'Save', icon: 'Save', command: 'save', shortcut: 'Ctrl+S' },
		{ label: 'Save as ...', icon: 'SaveAs', command: 'saveAs' },
		{ label: 'Save All', command: 'saveAll' },
		{ label: 'Dump Memory ...', command: 'dump', unavailable: true },
		{ label: 'Print ...', icon: 'Print', command: 'print' },
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
		{ label: 'Assemble', icon: 'Assemble', command: 'assemble', shortcut: 'F3' },
		{ label: 'Go', icon: 'Play', command: 'go', shortcut: 'F5' },
		{ label: 'Step', icon: 'StepForward', command: 'step', shortcut: 'F7' },
		{ label: 'Backstep', icon: 'StepBack', command: 'backstep', shortcut: 'F8' },
		{ label: 'Pause', icon: 'Pause', command: 'pause', shortcut: 'F9' },
		{ label: 'Stop', icon: 'Stop', command: 'stop', shortcut: 'F11' },
		{ label: 'Reset', icon: 'Reset', command: 'reset', shortcut: 'F12' },
		{ label: 'Clear all breakpoints', command: 'clearBreakpoints' },
		{ label: 'Toggle all breakpoints', command: 'toggleBreakpoints' }
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
	const engineOptions = [
		{ id: Settings.POPUP_SYSCALL_INPUT, label: 'Popup dialog for input syscalls' },
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
		if (['new', 'open', 'help', 'about', 'exit'].includes(action.command)) return true;
		if (!current) return false;
		if (action.command === 'undo') return current.undo.length > 0;
		if (action.command === 'redo') return current.redo.length > 0;
		return true;
	}
	function refresh() {
		revision++;
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
		refresh();
	}
	function sourceKeydown(event: KeyboardEvent) {
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
	function selection() {
		selectionStart = sourceInput?.selectionStart ?? 0;
		selectionEnd = sourceInput?.selectionEnd ?? 0;
	}
	function dismiss() {
		modal = null;
		closeQueue = [];
		saveQueue = [];
		closingAfterSave = false;
	}
	function report(error: unknown) {
		messages += `${error instanceof ProcessingException ? (error.errors()?.generateErrorAndWarningReport() ?? '') : error instanceof Error ? error.message : String(error)}\n`;
		messageTab = 'Mars Messages';
	}
	async function openFiles(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		for (const file of files) {
			try {
				editor.openFile(file.name, await file.text());
				refresh();
			} catch (error) {
				report(error);
			}
		}
		input.value = '';
		view = 'Edit';
		if (engineSettings[Settings.ASSEMBLE_ON_OPEN_ENABLED]) assemble();
		await tick();
		sourceInput?.focus();
	}
	function download(tab: EditPane, name: string) {
		try {
			downloadSource(name, tab.text);
			editor.markSaved(tab.id, name);
			refresh();
			return true;
		} catch (error) {
			report(error);
			return false;
		}
	}
	function save(tab: EditPane, as = false) {
		if (as || tab.isNew) {
			saveTarget = tab;
			filename = tab.name;
			modal = 'save';
		} else download(tab, tab.name);
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
		else if (download(tab, tab.name)) nextSave();
	}
	function confirmSave() {
		if (!saveTarget || !filename.trim()) return;
		if (!download(saveTarget, filename.trim())) return;
		modal = null;
		if (closingAfterSave) {
			closingAfterSave = false;
			editor.close(saveTarget.id);
			refresh();
			nextClose();
		} else nextSave();
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
		} else if (download(current, current.name)) {
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
		if (runActions.some((entry) => entry.command === command)) {
			await runCommand(command);
			return;
		}
		switch (command) {
			case 'new':
				editor.newFile();
				refresh();
				view = 'Edit';
				await tick();
				sourceInput?.focus();
				break;
			case 'open':
				fileInput.click();
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
				refresh();
				break;
			case 'redo':
				editor.redo();
				controller?.invalidate();
				refresh();
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
			case 'print':
				window.print();
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
	function keydown(event: KeyboardEvent) {
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
					n: 'new',
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
<svelte:window onkeydown={keydown} onbeforeunload={beforeUnload} />
<fieldset disabled={!ready} class="application-controls" aria-busy={!ready}>
	<input
		class="hidden"
		type="file"
		multiple
		accept=".asm,.s,.txt,.inc"
		bind:this={fileInput}
		onchange={openFiles}
		aria-label="Open assembly files"
	/>
	<div
		class="desktop flex h-dvh min-h-[480px] flex-col overflow-hidden bg-[#ededed] text-[12px] text-[#17202b]"
	>
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
					<label><input type="checkbox" bind:checked={showLabels} /> Show Labels Window</label>
					<label
						><input type="checkbox" bind:checked={hexAddresses} /> Addresses displayed in hexadecimal</label
					>
					<label
						><input type="checkbox" bind:checked={hexValues} /> Values displayed in hexadecimal</label
					>
					<label><input type="checkbox" bind:checked={showLines} /> Show line numbers</label>
					{#each engineOptions as option (option.id)}<label
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
		</nav>
		<div class="toolbar" aria-label="Toolbar">
			{#each [fileActions.filter((item) => item.icon), editActions.filter((item) => item.icon), runActions.filter((item) => item.icon), [helpActions[0]]] as group, groupIndex (groupIndex)}
				<div class="toolgroup">
					{#each group as item (item.command)}<button
							title={item.unavailable
								? `${item.label} — not yet available`
								: `${item.label}${item.shortcut ? ` (${item.shortcut})` : ''}`}
							aria-label={item.label}
							disabled={!enabled(item)}
							onclick={() => action(item.command)}
							><img src={icons[item.icon ?? '']} alt="" width="22" height="22" /></button
						>{/each}
				</div>
			{/each}
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
								style:--editor-caret={editorPreset.caretColor}
								style:--editor-selection={editorPreset.selectionBackground}
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
												style:color={syntaxStyles[span.id].color}
												style:font-style={syntaxStyles[span.id].italic ? 'italic' : 'normal'}
												style:font-weight={syntaxStyles[span.id].bold ? 'bold' : 'normal'}
												>{span.text}</span
											>{/each}&#10;</pre>
									<textarea
										bind:this={sourceInput}
										aria-label={`Source ${current.name}`}
										value={current.text}
										readonly={running}
										oninput={(event) => {
											edit(event.currentTarget.value);
											selection();
										}}
										onclick={selection}
										onkeydown={sourceKeydown}
										onkeyup={selection}
										onselect={selection}
										onscroll={(event) => {
											scrollTop = event.currentTarget.scrollTop;
											scrollLeft = event.currentTarget.scrollLeft;
										}}
										spellcheck="false"
										autocapitalize="off"
										autocomplete="off"
										wrap="off"></textarea>
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
				>{current ? `Line ${position.line}, Column ${position.column}` : ''}</span
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
{#if modal === 'save'}{#key saveTarget?.id}<Modal title="Save As" onclose={dismiss}
			><form
				onsubmit={(event) => {
					event.preventDefault();
					confirmSave();
				}}
			>
				<label class="form-field">File name<input bind:value={filename} required /></label>
				<p>Save downloads a copy. It does not overwrite the original file.</p>
				<div class="dialog-buttons">
					<button type="submit">Save</button><button type="button" onclick={dismiss}>Cancel</button>
				</div>
			</form></Modal
		>
	{/key}{:else if modal === 'close'}<Modal title="Save changes?" onclose={dismiss}
		><p>Save changes to {current?.name} before closing?</p>
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
			Use File → New or Open to edit MIPS assembly source. Each file has its own tab and undo
			history. Save downloads a copy of the source.
		</p>
		<p>
			Registers remain visible beside Edit and Execute. Use Settings to change value display and
			label visibility.
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
		<p><a href={asset('MARSlicense.txt')}>Read the MIT license</a></p>
		<div class="dialog-buttons"><button onclick={dismiss}>Close</button></div></Modal
	>{/if}

<style>
	.editor-divider {
		height: 5px;
		flex: 0 0 5px;
		cursor: row-resize;
		touch-action: none;
		background: #d4d9de;
		border-block: 1px solid #a8b0b8;
	}
	.editor-divider:hover,
	.editor-divider:focus-visible {
		background: #8db3d1;
		outline: 1px solid #2c679c;
	}
	.register-divider {
		width: 5px;
		flex: 0 0 5px;
		cursor: col-resize;
		touch-action: none;
		background: #d4d9de;
		border-inline: 1px solid #a8b0b8;
	}
	.register-divider:hover,
	.register-divider:focus-visible {
		background: #8db3d1;
		outline: 1px solid #2c679c;
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
		background: white;
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
		border-bottom: 1px solid #b0b0b0;
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
		background: #c6dcef;
	}
	.menu {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 20;
		min-width: 230px;
		padding: 3px;
		background: #f5f5f5;
		border: 1px solid #919191;
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
		background: #c6dcef;
	}
	kbd {
		margin-left: 25px;
		color: #667;
		font-size: 11px;
	}
	.toolbar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
		padding: 3px;
		border-bottom: 1px solid #999;
	}
	.toolgroup {
		display: flex;
		padding-right: 5px;
		border-right: 1px solid #aaa;
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
		border-color: #849eb5;
		background: #dbe8f2;
	}
	.toolgroup button:disabled img {
		opacity: 0.35;
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
		border: 1px solid #8d969e;
		background: white;
	}
	.tabs {
		display: flex;
		flex-shrink: 0;
		background: #e4e4e4;
		border-bottom: 1px solid #9ca7b0;
		padding: 2px 3px 0;
		gap: 2px;
	}
	.tabs button {
		padding: 4px 12px;
		border: 1px solid #a6aeb5;
		border-bottom: 0;
		border-radius: 3px 3px 0 0;
	}
	.tabs button.active {
		background: white;
		font-weight: 600;
	}
	.source-tabs {
		display: flex;
		min-height: 28px;
		background: #e7e7e7;
		overflow-x: auto;
		flex-shrink: 0;
	}
	.source-tabs > div {
		display: flex;
		border-right: 1px solid #aaa;
	}
	.source-tabs button {
		padding: 4px 7px;
		white-space: nowrap;
	}
	.source-tabs .active {
		background: white;
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
		background: #f1f1f1;
		border-right: 1px solid #ddd;
		text-align: right;
		padding: 5px 6px 5px 0;
		color: #777;
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
		background: #f7f7f7;
	}
	.messages {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 80px;
		border: 1px solid #8d969e;
	}
	.messages textarea {
		flex: 1;
		min-height: 0;
		background: white;
		padding: 6px;
		resize: none;
		font: 13px/1.4 monospace;
	}
	.tabs .clear {
		margin-left: auto;
		border: 1px solid #aaa;
		padding: 1px 12px;
		margin-bottom: 2px;
		border-radius: 0;
	}
	.console-input {
		display: flex;
		gap: 8px;
		padding: 4px 6px;
		background: #eee;
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
		border: 1px solid #aaa;
		background: white;
		resize: none;
	}
	.console-input button {
		padding: 2px 8px;
		border: 1px solid #aaa;
	}
	footer {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 2px 8px;
		border-top: 1px solid #aaa;
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
		border: 1px solid #9a9a9a;
		background: white;
	}
	.dialog-buttons {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 16px;
	}
	.dialog-buttons button {
		border: 1px solid #929eaa;
		background: #f8f8f8;
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
		color: #225888;
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
