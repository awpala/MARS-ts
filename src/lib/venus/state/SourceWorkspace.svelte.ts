import { tick } from 'svelte';
import { Editor, type EditPane } from '#lib/editor/Editor.js';
import { SourceLibrary, sourceName, type SavedSource } from '#lib/browser/SourceLibrary.js';
import type { DisplayPreferences } from './DisplayPreferences.svelte.js';
/** Cross-domain capabilities injected by the desktop; the workspace never creates a machine. */
export type WorkspaceHost = {
	/** Invalidate assembly after source changes. */
	invalidate: () => void;
	/** Report a recoverable error through desktop messages. */
	report: (error: unknown) => void;
	/** Read whether simulation currently blocks source operations. */
	running: () => boolean;
	/** Read the session's assemble-on-open preference. */
	assembleOnOpen: () => boolean;
	/** Request assembly after opening when configured. */
	assemble: () => void;
};
/** Per-desktop source buffers, local-library workflows, selection, and recovery persistence. */
export class SourceWorkspace {
	/** Framework-free editor model owned by this workspace. */
	editor = new Editor();
	private revision = $state(0);
	/** Reactive snapshots of open editor buffers. */
	tabs = $derived.by(() => {
		void this.revision;
		return this.editor.getEditPanes().map((tab) => ({ ...tab }));
	});
	/** Reactive snapshot of the selected buffer and its undo/redo availability. */
	current = $derived.by(() => {
		void this.revision;
		const tab = this.editor.getCurrentEditTab();
		return tab ? { ...tab, undo: [...tab.undo], redo: [...tab.redo] } : undefined;
	});
	private sourceLibrary = new SourceLibrary();
	/** Last successfully read or committed source library. */
	libraryFiles = $state.raw<SavedSource[]>([]);
	/** Names selected by the Open/Delete dialogs. */
	selectedSources = $state<string[]>([]);
	/** Pending exact source records awaiting import confirmation. */
	importSources = $state.raw<SavedSource[]>([]);
	/** Current file-dialog error; a failed write never clears dirty state. */
	fileError = $state('');
	/** Recoverable workspace-backup failure shown by the desktop. */
	backupError = $state('');
	/** Whether source mutations commit to the local library. */
	autoSave = $state(false);
	/** Auto Save failure or recovered-draft conflict message. */
	autoSaveError = $state('');
	private workspaceWritable = false;
	/** Whether Save As is waiting for overwrite confirmation. */
	replaceSave = $state(false);
	/** Whether Save As also removes the old library name. */
	renameSource = $state(false);
	/** Current source-workflow dialog; Help and syscall input have separate owners. */
	modal = $state<
		'open' | 'delete' | 'import' | 'save' | 'close' | 'find' | 'rename-warning' | null
	>(null);
	/** Pending Save As filename. */
	filename = $state('');
	/** Buffer currently being saved, retained across dialog steps. */
	saveTarget = $state.raw<EditPane>();
	private closeQueue: number[] = [];
	private saveQueue: number[] = [];
	private closingAfterSave = false;
	/** Current source-selection start offset. */
	selectionStart = $state(0);
	/** Current source-selection end offset. */
	selectionEnd = $state(0);
	/** Current source viewport top offset, restored with the desktop session. */
	sourceScrollTop = $state(0);
	/** Current source viewport left offset, restored with the desktop session. */
	sourceScrollLeft = $state(0);
	/** Mounted source textarea supplied by SourceEditor; cleared on unmount. */
	sourceInput = $state<HTMLTextAreaElement>();
	/** Line and column derived from the selected source and caret. */
	position = $derived.by(() => {
		const before = this.current?.text.slice(0, this.selectionStart) ?? '';
		return { line: before.split('\n').length, column: before.length - before.lastIndexOf('\n') };
	});
	private ready = $state(false);
	private disposed = false;
	/** Compose with display navigation and explicit execution/reporting capabilities. */
	constructor(
		private readonly display: DisplayPreferences,
		private readonly host: WorkspaceHost
	) {}
	/** Restore saved sources and recovery drafts; conflicting drafts disable Auto Save without discarding either version. */
	restore(): void {
		let recoveredConflict = false;
		try {
			this.libraryFiles = this.sourceLibrary.read();
		} catch (error) {
			this.fileFailure(error);
		}
		try {
			const drafts = this.sourceLibrary.readWorkspace();
			let selected: number | undefined;
			for (const draft of drafts) {
				const saved = this.libraryFiles.find((file) => file.name === draft.name);
				const clean = !draft.isNew && draft.source === draft.savedSource;
				const matchesSaved = saved?.source === draft.source;
				if (saved && !clean && !matchesSaved && saved.source !== draft.savedSource)
					recoveredConflict = true;
				const tab =
					saved && (clean || matchesSaved)
						? this.editor.openFile(saved.name, saved.source)
						: this.editor.restoreFile(draft.name, draft.source, draft.savedSource, draft.isNew);
				if (draft.selected) selected = tab.id;
			}
			if (selected !== undefined) this.editor.setCurrentEditTab(selected);
			this.workspaceWritable = true;
			this.refresh();
		} catch (error) {
			this.backupError = `Unable to restore source workspace: ${error instanceof Error ? error.message : String(error)}. Existing backup has been preserved.`;
		}
		if (recoveredConflict) {
			this.autoSave = false;
			this.autoSaveError =
				'A recovered draft differs from its latest saved source. Both versions are retained; Auto Save is off. Review the draft before saving or enabling Auto Save.';
		}
	}
	/** Enable persistence once initialization has completed, then save the restored workspace snapshot. */
	activate(): void {
		this.ready = true;
		this.refresh();
	}
	/** Stop persistence and ignore pending clipboard reads when the owning desktop unmounts. */
	dispose(): void {
		this.disposed = true;
		this.ready = false;
		this.sourceInput = undefined;
	}
	/** Resolve assembly includes from open buffers first, then committed browser sources. */
	readSource = (name: string): string => {
		const tab = this.editor
			.getEditPanes()
			.find((entry) => this.normalizePath(entry.name) === this.normalizePath(name));
		if (tab) return tab.text;
		const saved = this.sourceLibrary
			.read()
			.find((entry) => entry.name === this.normalizePath(name));
		if (!saved) throw new Error(`Source file "${name}" is not in the source library.`);
		return saved.source;
	};
	/** Execute source/file actions against this workspace, preserving normal dirty-buffer workflows. */
	execute = async (command: string): Promise<void> => {
		if (this.disposed) return;
		switch (command) {
			case 'new': {
				const tab = this.createSource();
				if (tab) await this.focusSource(tab);
				break;
			}
			case 'open':
				this.showOpen();
				break;
			case 'autoSave':
				this.autoSave = !this.autoSave;
				this.autoSaveError = '';
				this.refresh(true);
				break;
			case 'close':
				if (this.current) this.startClose([this.current.id]);
				break;
			case 'closeAll':
			case 'exit':
				this.startClose(this.tabs.map((tab) => tab.id));
				break;
			case 'save':
				if (this.current) this.save(this.current);
				break;
			case 'saveAs':
				if (this.current) this.save(this.current, true);
				break;
			case 'saveAll':
				this.saveQueue = this.tabs
					.filter((tab) => !tab.isNew || tab.text.length > 0)
					.map((tab) => tab.id);
				this.nextSave();
				break;
			case 'undo':
				this.editor.undo();
				this.host.invalidate();
				this.refresh(true);
				break;
			case 'redo':
				this.editor.redo();
				this.host.invalidate();
				this.refresh(true);
				break;
			case 'cut':
			case 'copy':
			case 'paste':
				await this.clipboard(command);
				break;
			case 'selectAll':
				this.sourceInput?.focus();
				this.sourceInput?.select();
				this.selection();
				break;
			case 'find':
				this.modal = 'find';
				break;
		}
	};
	/** Create and initialize a new buffer synchronously; optional source records one normal edit before persistence. Returns nothing after disposal or while running. */
	createSource(source?: string): EditPane | undefined {
		if (this.disposed || this.host.running()) return;
		try {
			this.libraryFiles = this.sourceLibrary.read();
		} catch (error) {
			this.fileFailure(error);
		}
		const tab = this.editor.newFile(this.libraryFiles.map((file) => file.name));
		if (source !== undefined) {
			this.editor.setText(source);
			this.host.invalidate();
		}
		this.refresh(true);
		this.display.view = 'Edit';
		return tab;
	}
	/** Focus after rendering only while the requested buffer still belongs to the active editor view. */
	focusSource = async (tab: EditPane): Promise<void> => {
		await tick();
		if (!this.disposed && this.editor.getCurrentEditTab() === tab && this.display.view === 'Edit')
			this.sourceInput?.focus();
	};
	private normalizePath = (name: string): string => {
		const parts: string[] = [];
		for (const part of name.split('/')) {
			if (part === '..') parts.pop();
			else if (part !== '.' && part !== '') parts.push(part);
		}
		return parts.join('/');
	};
	/** Select a source location from Execute and focus the matching editor line. */
	showSource = async (name: string, line: number) => {
		const tab = this.editor
			.getEditPanes()
			.find((entry) => this.normalizePath(entry.name) === this.normalizePath(name));
		if (!tab) return;
		this.select(tab.id);
		this.display.view = 'Edit';
		await tick();
		if (this.disposed || this.editor.getCurrentEditTab() !== tab || this.display.view !== 'Edit')
			return;
		const offset = tab.text
			.split('\n')
			.slice(0, Math.max(0, line - 1))
			.reduce((total, text) => total + text.length + 1, 0);
		this.sourceInput?.focus();
		this.sourceInput?.setSelectionRange(offset, offset);
		if (this.sourceInput) this.sourceInput.scrollTop = Math.max(0, (line - 3) * 21);
		this.selection();
	};
	/** Publish editor snapshots, optionally commit edits, and preserve recovery backups. */
	refresh = (commit = false) => {
		this.revision++;
		if (this.ready && this.autoSave && commit) {
			const changed = this.editor
				.getEditPanes()
				.filter((tab) => this.editor.isDirty(tab) && (!tab.isNew || tab.text.length > 0));
			if (changed.length) {
				try {
					this.libraryFiles = this.sourceLibrary.saveMany(
						changed.map((tab) => ({ name: tab.name, source: tab.text }))
					);
					for (const tab of changed) this.editor.markSaved(tab.id, tab.name);
					this.autoSaveError = '';
				} catch (error) {
					this.autoSaveError = `Auto Save failed: ${error instanceof Error ? error.message : String(error)}. Changes remain uncommitted.`;
				}
			}
		}
		if (this.ready && this.workspaceWritable) {
			try {
				this.sourceLibrary.saveWorkspace(
					this.editor.getEditPanes().map((tab) => ({
						name: tab.name,
						source: tab.text,
						savedSource: tab.savedText,
						isNew: tab.isNew,
						selected: tab.id === this.editor.getCurrentEditTab()?.id
					}))
				);
				this.backupError = '';
			} catch (error) {
				this.backupError = `Source backup failed: ${error instanceof Error ? error.message : String(error)}. Keep this tab open or export your work.`;
			}
		}
	};
	/** Select an editor buffer and reset the exposed selection. */
	select = (id: number) => {
		this.editor.setCurrentEditTab(id);
		this.selectionStart = 0;
		this.selectionEnd = 0;
		this.refresh();
	};
	/** Reorder open tabs without selecting, editing, or invalidating the loaded machine; persist the ordered workspace. */
	reorder = (id: number, targetId: number, after: boolean): void => {
		if (this.disposed || this.host.running() || this.modal) return;
		this.editor.reorder(id, targetId, after);
		this.refresh();
	};
	/** Record source edits, invalidate assembly, and persist according to workspace policy. */
	edit = (text: string) => {
		this.editor.setText(text);
		this.host.invalidate();
		this.refresh(true);
	};
	/** Read selection offsets from the current source textarea. */
	selection = () => {
		this.selectionStart = this.sourceInput?.selectionStart ?? 0;
		this.selectionEnd = this.sourceInput?.selectionEnd ?? 0;
	};
	/** Dismiss a source dialog and abandon pending save/close/import queues. */
	dismiss = () => {
		this.modal = null;
		this.closeQueue = [];
		this.saveQueue = [];
		this.closingAfterSave = false;
		this.renameSource = false;
		this.fileError = '';
		this.replaceSave = false;
		this.importSources = [];
	};
	private fileFailure = (error: unknown) => {
		this.fileError = error instanceof Error ? error.message : String(error);
		this.host.report(error);
	};
	private showOpen = () => {
		this.fileError = '';
		this.selectedSources = [];
		this.modal = 'open';
		try {
			this.libraryFiles = this.sourceLibrary.read();
		} catch (error) {
			this.fileFailure(error);
		}
	};
	private openSources = async (sources: readonly SavedSource[]) => {
		for (const file of sources) {
			const existing = this.editor.getEditPanes().find((tab) => tab.name === file.name);
			if (existing) this.editor.setCurrentEditTab(existing.id);
			else this.editor.openFile(file.name, file.source);
		}
		this.modal = null;
		this.refresh();
		this.display.view = 'Edit';
		if (this.host.assembleOnOpen()) this.host.assemble();
		const tab = this.editor.getCurrentEditTab();
		if (tab) await this.focusSource(tab);
	};
	/** Ask for confirmation before deleting selected library sources. */
	requestDelete = () => {
		this.fileError = '';
		this.modal = 'delete';
	};
	/** Return to Open without deleting sources. */
	cancelDelete = () => {
		this.fileError = '';
		this.modal = 'open';
	};
	/** Delete selected library sources and close their buffers only after storage succeeds. */
	confirmDelete = () => {
		try {
			this.libraryFiles = this.sourceLibrary.delete(this.selectedSources);
			for (const tab of [...this.editor.getEditPanes()]) {
				if (this.selectedSources.includes(tab.name)) this.editor.close(tab.id);
			}
			this.host.invalidate();
			this.refresh();
			this.selectedSources = [];
			this.fileError = '';
			this.modal = 'open';
		} catch (error) {
			this.fileFailure(error);
		}
	};
	/** Open selected committed sources through the editor workflow. */
	confirmOpen = () => {
		try {
			this.libraryFiles = this.sourceLibrary.read();
			void this.openSources(
				this.libraryFiles.filter((file) => this.selectedSources.includes(file.name))
			);
		} catch (error) {
			this.fileFailure(error);
		}
	};
	/** Stage exact imported sources and request confirmation for existing library names. */
	acceptImport = (sources: SavedSource[]): void => {
		this.fileError = '';
		this.importSources = sources;
		try {
			this.libraryFiles = this.sourceLibrary.read();
			this.modal = 'import';
			if (!sources.some((file) => this.libraryFiles.some((saved) => saved.name === file.name)))
				this.confirmImport();
		} catch (error) {
			this.importFailure(error);
		}
	};
	/** Show a recoverable import/read error without committing any sources. */
	importFailure = (error: unknown): void => {
		this.modal = 'import';
		this.fileFailure(error);
	};
	/** Commit pending imports and open them, preserving dirty-buffer safeguards. */
	confirmImport = () => {
		try {
			if (this.host.running()) throw new Error('Stop execution before importing sources.');
			for (const file of this.importSources) {
				const tab = this.editor.getEditPanes().find((entry) => entry.name === file.name);
				if (tab && this.editor.isDirty(tab))
					throw new Error(`Save or close the edited "${file.name}" before replacing it.`);
			}
			this.libraryFiles = this.sourceLibrary.saveMany(this.importSources);
			for (const file of this.importSources) {
				const tab = this.editor.getEditPanes().find((entry) => entry.name === file.name);
				if (tab) this.editor.close(tab.id);
			}
			this.host.invalidate();
			void this.openSources(this.importSources);
			this.importSources = [];
		} catch (error) {
			this.fileFailure(error);
		}
	};
	private persistSource = (tab: EditPane, name: string, rename = false): boolean => {
		if (tab.isNew && tab.text.length === 0) {
			this.fileError = 'Enter at least one character before saving a new source.';
			return false;
		}
		try {
			this.libraryFiles = rename
				? this.sourceLibrary.rename(tab.name, name, tab.text)
				: this.sourceLibrary.save(name, tab.text);
			if (name !== tab.name) this.host.invalidate();
			this.editor.markSaved(tab.id, name);
			this.refresh();
			return true;
		} catch (error) {
			this.fileFailure(error);
			return false;
		}
	};
	private save = (tab: EditPane, as = false) => {
		if (tab.isNew && tab.text.length === 0) return;
		this.renameSource = false;
		this.fileError = '';
		this.replaceSave = false;
		if (as || tab.isNew) {
			this.saveTarget = tab;
			this.filename = tab.name;
			this.modal = 'save';
		} else if (!this.persistSource(tab, tab.name)) {
			this.saveTarget = tab;
			this.filename = tab.name;
			this.modal = 'save';
		}
	};
	/** Commit an inline filename edit through Save As Rename. Invalid names keep the current buffer/library unchanged and open a warning; collisions retain explicit replacement confirmation. */
	rename = (id: number, filename: string): void => {
		if (this.disposed || this.host.running() || this.modal) return;
		const tab = this.editor.getEditPanes().find((tab) => tab.id === id);
		if (!tab || filename === tab.name) return;
		this.dismiss();
		this.select(id);
		this.saveTarget = tab;
		this.filename = filename;
		this.renameSource = true;
		this.modal = 'save';
		this.confirmSave();
	};
	private validateSaveName(tab: EditPane): string {
		const name = sourceName(this.filename);
		if (this.renameSource) {
			const basename = name.split('/').at(-1) ?? '';
			const extension = /^(.+)\.(asm|s)$/i.exec(basename);
			if (!extension || !extension[1].replaceAll('.', '').trim() || /[<>"|?*]/.test(name))
				throw new Error(
					'Enter an assembly filename with a nonempty name and a .asm or .s extension.'
				);
		}
		if (this.editor.getEditPanes().some((other) => other.id !== tab.id && other.name === name))
			throw new Error(`"${name}" is already open. Choose another name or close that tab first.`);
		return name;
	}
	private nextSave = () => {
		const id = this.saveQueue.shift();
		if (id === undefined) return;
		const tab = this.editor.getEditPanes().find((pane) => pane.id === id);
		if (!tab) {
			this.nextSave();
			return;
		}
		this.select(id);
		if (tab.isNew) this.save(tab);
		else if (this.persistSource(tab, tab.name)) this.nextSave();
		else {
			this.saveQueue = [];
			this.saveTarget = tab;
			this.filename = tab.name;
			this.modal = 'save';
		}
	};
	/** Validate and commit Save As, then continue any pending save or close queue. */
	confirmSave = (overwrite = false) => {
		if (!this.saveTarget) return;
		this.fileError = '';
		let name: string;
		try {
			name = this.validateSaveName(this.saveTarget);
		} catch (error) {
			this.fileFailure(error);
			if (this.renameSource) {
				this.filename = this.saveTarget.name;
				this.replaceSave = false;
				this.modal = 'rename-warning';
			}
			return;
		}
		try {
			this.libraryFiles = this.sourceLibrary.read();
			if (
				!overwrite &&
				(this.saveTarget.isNew || name !== this.saveTarget.name) &&
				this.libraryFiles.some((file) => file.name === name)
			) {
				this.replaceSave = true;
				return;
			}
			if (!this.persistSource(this.saveTarget, name, this.renameSource && !this.saveTarget.isNew))
				return;
			this.modal = null;
			this.replaceSave = false;
			if (this.closingAfterSave) {
				this.closingAfterSave = false;
				this.editor.close(this.saveTarget.id);
				this.refresh();
				this.nextClose();
			} else this.nextSave();
		} catch (error) {
			this.fileFailure(error);
		}
	};
	/** Snapshot the selected source, or merge all saved sources with current open-buffer edits for export. */
	sourcesForExport(all: boolean): SavedSource[] {
		const sources: SavedSource[] = all ? this.sourceLibrary.read() : [];
		for (const tab of all ? this.editor.getEditPanes() : this.current ? [this.current] : []) {
			const index = sources.findIndex((file) => file.name === tab.name);
			if (index < 0) sources.push({ name: tab.name, source: tab.text });
			else sources[index] = { name: tab.name, source: tab.text };
		}
		return sources;
	}
	private nextClose = (): void => {
		const id = this.closeQueue.shift();
		if (id === undefined) {
			this.modal = null;
			return;
		}
		const tab = this.editor.getEditPanes().find((pane) => pane.id === id);
		if (!tab) return this.nextClose();
		this.select(id);
		if (this.editor.isDirty(tab) && (!tab.isNew || tab.text.length > 0)) {
			this.modal = 'close';
			return;
		}
		this.editor.close(id);
		this.refresh();
		this.nextClose();
	};
	/** Start the ordered dirty-buffer close workflow. */
	startClose = (ids: number[]) => {
		this.closeQueue = ids;
		this.nextClose();
	};
	/** Discard the current buffer and continue the close queue. */
	discard = () => {
		if (this.current) this.editor.close(this.current.id);
		this.refresh();
		this.nextClose();
	};
	/** Save the current buffer before continuing the close queue. */
	saveAndClose = () => {
		if (!this.current) return;
		if (this.current.isNew) {
			this.closingAfterSave = true;
			this.save(this.current);
		} else if (this.persistSource(this.current, this.current.name)) {
			this.editor.close(this.current.id);
			this.refresh();
			this.nextClose();
		}
	};
	private clipboard = async (command: string) => {
		if (!this.current) return;
		try {
			if (command === 'paste') {
				const tab = this.current,
					start = this.selectionStart,
					end = this.selectionEnd;
				const text = await navigator.clipboard.readText();
				if (this.disposed || this.current !== tab || this.host.running()) return;
				this.edit(tab.text.slice(0, start) + text + tab.text.slice(end));
			} else {
				const tab = this.current,
					start = this.selectionStart,
					end = this.selectionEnd;
				await navigator.clipboard.writeText(tab.text.slice(start, end));
				if (this.disposed) return;
				if (command === 'cut' && this.current === tab && !this.host.running())
					this.edit(tab.text.slice(0, start) + tab.text.slice(end));
			}
		} catch {
			if (this.disposed) return;
			this.host.report(
				'Clipboard access was denied. Use the browser’s Cut, Copy, and Paste keyboard shortcuts.'
			);
		}
	};
}
