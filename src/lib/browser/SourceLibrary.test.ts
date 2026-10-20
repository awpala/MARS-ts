import { describe, expect, it } from 'vitest';
import {
	SourceLibrary,
	SOURCE_LIBRARY_STORAGE_KEY,
	SOURCE_WORKSPACE_STORAGE_KEY,
	sourceName
} from './SourceLibrary.js';

function fixture() {
	const values = new Map<string, string>();
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		}
	};
	return { values, storage, library: new SourceLibrary(() => storage) };
}

describe('browser source filesystem', () => {
	it('stores full Unicode source text, updates one file and retains fresh unrelated records', () => {
		const { library, values } = fixture();
		const source = '.data\nmessage: .asciiz "こんにちは"\n.text\n\tli $v0,10\n';
		library.save('main.asm', source);
		library.save('include/constants.inc', '.eqv X 12\n');
		library.save('main.asm', source + 'syscall\n');
		expect(JSON.parse(values.get(SOURCE_LIBRARY_STORAGE_KEY)!)).toEqual([
			{ name: 'main.asm', source: source + 'syscall\n' },
			{ name: 'include/constants.inc', source: '.eqv X 12\n' }
		]);
		expect(library.read()).toHaveLength(2);
	});
	it('recovers in-progress text independently of committed source and preserves all open buffers', () => {
		const { library, values } = fixture();
		library.save('saved.asm', 'committed');
		const drafts = [
			{
				name: 'saved.asm',
				source: 'unsaved\nchanges\n',
				savedSource: 'committed',
				isNew: false,
				selected: false
			},
			{ name: 'mips1.asm', source: 'never saved\n', savedSource: '', isNew: true, selected: true }
		];
		library.saveWorkspace(drafts);
		expect(library.readWorkspace()).toEqual(drafts);
		expect(JSON.parse(values.get(SOURCE_WORKSPACE_STORAGE_KEY)!)).toEqual(drafts);
		expect(library.read()).toEqual([{ name: 'saved.asm', source: 'committed' }]);
	});
	it('leaves corrupt stored sources untouched on reads and save attempts', () => {
		const { library, values } = fixture();
		for (const raw of [
			'broken',
			'{}',
			'[{"name":"one.asm"}]',
			'[{"name":"../x","source":"x"}]',
			'[{"name":"x","source":"a"},{"name":"./x","source":"b"}]'
		]) {
			values.set(SOURCE_LIBRARY_STORAGE_KEY, raw);
			expect(() => library.read()).toThrow();
			expect(() => library.save('new.asm', 'new')).toThrow();
			expect(values.get(SOURCE_LIBRARY_STORAGE_KEY)).toBe(raw);
		}
	});
	it('rejects invalid workspace text and types without replacing the recovery record', () => {
		const { library, values } = fixture();
		for (const raw of [
			'{}',
			'[{"name":"x","source":12,"savedSource":"","isNew":true,"selected":true}]'
		]) {
			values.set(SOURCE_WORKSPACE_STORAGE_KEY, raw);
			expect(() => library.readWorkspace()).toThrow();
			expect(values.get(SOURCE_WORKSPACE_STORAGE_KEY)).toBe(raw);
		}
	});
	it('rejects duplicate imports before writing and surfaces quota failures atomically', () => {
		const { library, values, storage } = fixture();
		library.save('old.asm', 'retain');
		const before = values.get(SOURCE_LIBRARY_STORAGE_KEY);
		expect(() =>
			library.saveMany([
				{ name: 'a.asm', source: 'a' },
				{ name: './a.asm', source: 'b' }
			])
		).toThrow();
		expect(values.get(SOURCE_LIBRARY_STORAGE_KEY)).toBe(before);
		storage.setItem = () => {
			throw new Error('Quota exceeded');
		};
		expect(() =>
			library.saveMany([
				{ name: 'old.asm', source: 'replace' },
				{ name: 'new.asm', source: 'new' }
			])
		).toThrow('Quota exceeded');
		expect(values.get(SOURCE_LIBRARY_STORAGE_KEY)).toBe(before);
		expect(() => library.saveWorkspace([])).toThrow('Quota exceeded');
	});
	it('renames and deletes only selected sources, retaining originals on failed writes', () => {
		const { library, values, storage } = fixture();
		library.saveMany([
			{ name: 'old.asm', source: 'old' },
			{ name: 'keep.asm', source: 'keep' }
		]);
		const before = values.get(SOURCE_LIBRARY_STORAGE_KEY);
		const write = storage.setItem;
		storage.setItem = () => {
			throw new Error('Storage denied');
		};
		expect(() => library.rename('old.asm', 'new.asm', 'edited')).toThrow('Storage denied');
		expect(() => library.delete(['old.asm'])).toThrow('Storage denied');
		expect(values.get(SOURCE_LIBRARY_STORAGE_KEY)).toBe(before);
		storage.setItem = write;
		library.rename('old.asm', 'new.asm', 'edited');
		expect(library.read()).toEqual([
			{ name: 'keep.asm', source: 'keep' },
			{ name: 'new.asm', source: 'edited' }
		]);
		library.delete(['new.asm']);
		expect(library.read()).toEqual([{ name: 'keep.asm', source: 'keep' }]);
	});
	it('normalizes relative include paths and rejects native paths', () => {
		expect(sourceName(' ./folder/../include\\constant.asm ')).toBe('include/constant.asm');
		for (const name of ['', '../secret.asm', '/tmp/main.asm', 'C:\\main.asm', 'folder/'])
			expect(() => sourceName(name)).toThrow();
	});
});
