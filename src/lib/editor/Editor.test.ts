import { describe, expect, it } from 'vitest';
import { Editor } from './Editor.js';

describe('browser editor buffer lifecycle', () => {
	it('restores exact draft text and dirty baseline while avoiding persisted default names', () => {
		const editor = new Editor();
		const restored = editor.restoreFile('mips1.asm', 'draft', 'saved', false);
		expect(editor.isDirty(restored)).toBe(true);
		expect(restored.text).toBe('draft');
		expect(editor.newFile(['mips2.asm']).name).toBe('mips3.asm');
	});
	it('counts default names independently of opening existing files', () => {
		const editor = new Editor();
		editor.openFile('existing.asm', '');
		expect(editor.newFile().name).toBe('mips1.asm');
		expect(editor.newFile().name).toBe('mips2.asm');
	});
	it('isolates tabs and restores dirty state across undo, redo, and save', () => {
		const editor = new Editor();
		const original = editor.openFile('same.asm', 'one');
		editor.setText('two');
		expect(editor.isDirty(original)).toBe(true);
		editor.undo();
		expect(editor.isDirty(original)).toBe(false);
		editor.redo();
		expect(original.text).toBe('two');
		editor.markSaved(original.id, 'renamed.asm');
		expect(editor.isDirty(original)).toBe(false);
		const second = editor.openFile('same.asm', 'other');
		editor.setText('edited other');
		editor.setCurrentEditTab(original.id);
		expect(editor.getCurrentEditTab()?.text).toBe('two');
		editor.close(original.id);
		expect(editor.getCurrentEditTab()?.id).toBe(second.id);
		editor.close(second.id);
		expect(editor.getCurrentEditTab()).toBeUndefined();
	});

	it('keeps new files dirty and clears the redo branch after a new edit', () => {
		const editor = new Editor();
		const tab = editor.newFile();
		expect(editor.isDirty(tab)).toBe(true);
		editor.setText('a');
		editor.setText('b');
		editor.undo();
		editor.setText('c');
		editor.redo();
		expect(tab.text).toBe('c');
		expect(tab.redo).toEqual([]);
		expect(new Editor().getEditPanes()).toEqual([]);
	});
});
