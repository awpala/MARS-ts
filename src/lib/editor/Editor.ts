/**
 * Browser adaptation of mars/venus/Editor.java and EditTabbedPane.java.
 * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 */

/** Detached undo/redo recovery payload, applied only to an identical source buffer. */
export interface EditHistory {
	/** Virtual source identity. */
	name: string;
	/** Exact current text anchoring this history branch. */
	text: string;
	/** Prior revisions, oldest first. */
	undo: string[];
	/** Undone revisions in the editor's stack order. */
	redo: string[];
}

/** An editor buffer owned by one Editor instance; the view never mutates its history. */
export interface EditPane {
	/** Stable session-local tab identity. */
	id: number;
	/** Virtual source filename, without a native filesystem path. */
	name: string;
	/** Current source text. */
	text: string;
	/** Text at the last successful library open or save. */
	savedText: string;
	/** True until the first named save. */
	isNew: boolean;
	/** Prior source revisions, owned by Editor. */
	undo: string[];
	/** Undone revisions, owned by Editor. */
	redo: string[];
}

/** Owns source tabs and edit history; browser dialogs and I/O are supplied by the view. */
export class Editor {
	private nextId = 1;
	private newUsageCount = 0;
	private documents: EditPane[] = [];
	private selectedId: number | undefined;

	/** Returns the open tabs in display order; callers must not mutate them. */
	getEditPanes(): readonly EditPane[] {
		return this.documents;
	}
	/** Returns the selected tab, or undefined when no source is open. */
	getCurrentEditTab(): EditPane | undefined {
		return this.documents.find((tab) => tab.id === this.selectedId);
	}
	/** Selects an existing tab without changing its contents. */
	setCurrentEditTab(id: number): void {
		if (this.documents.some((tab) => tab.id === id)) this.selectedId = id;
	}
	/** Move one open tab before or after another, retaining buffer identity, history, and current selection. */
	reorder(id: number, targetId: number, after = false): void {
		if (id === targetId) return;
		const source = this.documents.findIndex((tab) => tab.id === id);
		if (source < 0 || !this.documents.some((tab) => tab.id === targetId)) return;
		const [tab] = this.documents.splice(source, 1);
		const target = this.documents.findIndex((tab) => tab.id === targetId);
		this.documents.splice(target + (after ? 1 : 0), 0, tab);
	}
	/** Generates the next mipsN.asm filename; opening existing files does not advance this counter. */
	getNextDefaultFilename(): string {
		return `mips${++this.newUsageCount}.asm`;
	}
	/** Opens a new source buffer, skipping names already open or reserved by the saved library. */
	newFile(reservedNames: readonly string[] = []): EditPane {
		let name: string;
		do {
			name = this.getNextDefaultFilename();
		} while (reservedNames.includes(name) || this.documents.some((tab) => tab.name === name));
		return this.openFile(name, '', true);
	}
	/** Adds source text; the presenter selects existing library tabs instead of reopening them. */
	openFile(name: string, text: string, isNew = false): EditPane {
		const tab = { id: this.nextId++, name, text, savedText: text, isNew, undo: [], redo: [] };
		this.documents.push(tab);
		this.selectedId = tab.id;
		return tab;
	}
	/** Restores a persisted working buffer and its explicit save baseline, with fresh undo history. */
	restoreFile(name: string, text: string, savedText: string, isNew: boolean): EditPane {
		const tab = this.openFile(name, text, isNew);
		tab.savedText = savedText;
		return tab;
	}
	/** Records one source edit and discards the redo branch. */
	setText(text: string): void {
		const tab = this.getCurrentEditTab();
		if (!tab || tab.text === text) return;
		tab.undo.push(tab.text);
		tab.text = text;
		tab.redo = [];
	}
	/** Copy each buffer's undo/redo branch for browser recovery; callers must track editor revision changes. */
	captureHistory(): EditHistory[] {
		return this.documents.map((tab) => ({
			name: tab.name,
			text: tab.text,
			undo: [...tab.undo],
			redo: [...tab.redo]
		}));
	}
	/** Recover history only for an exact source identity/text match, leaving conflicting drafts untouched. */
	restoreHistory(records: readonly EditHistory[]): void {
		for (const tab of this.documents) {
			const record = records.find((r) => r.name === tab.name && r.text === tab.text);
			if (record) {
				tab.undo = [...record.undo];
				tab.redo = [...record.redo];
			}
		}
	}
	/** Restores the preceding source revision when available. */
	undo(): void {
		const tab = this.getCurrentEditTab();
		const previous = tab?.undo.pop();
		if (tab && previous !== undefined) {
			tab.redo.push(tab.text);
			tab.text = previous;
		}
	}
	/** Reapplies an undone source revision when available. */
	redo(): void {
		const tab = this.getCurrentEditTab();
		const next = tab?.redo.pop();
		if (tab && next !== undefined) {
			tab.undo.push(tab.text);
			tab.text = next;
		}
	}
	/** Reports edits since open/save, including unsaved new buffers. */
	isDirty(tab: EditPane): boolean {
		return tab.isNew || tab.text !== tab.savedText;
	}
	/** Records a successful persistent library save and its filename. */
	markSaved(id: number, name: string): void {
		const tab = this.documents.find((pane) => pane.id === id);
		if (tab) {
			tab.name = name;
			tab.savedText = tab.text;
			tab.isNew = false;
		}
	}
	/** Closes a tab after the caller has handled its unsaved-change decision. */
	close(id: number): void {
		const index = this.documents.findIndex((tab) => tab.id === id);
		if (index < 0) return;
		this.documents.splice(index, 1);
		if (this.selectedId === id)
			this.selectedId = this.documents[Math.min(index, this.documents.length - 1)]?.id;
	}
}
