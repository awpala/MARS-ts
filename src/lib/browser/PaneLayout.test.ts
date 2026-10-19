import { describe, expect, it } from 'vitest';
import { loadPaneLayout, savePaneLayout, PANE_LAYOUT_STORAGE_KEY } from './PaneLayout.js';

describe('browser pane preferences', () => {
	it('round-trips persisted widths and ratios without touching machine state', () => {
		const values = new Map<string, string>();
		const storage = () => ({
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => {
				values.set(key, value);
			}
		});
		savePaneLayout({ registerWidth: 425, editorFraction: 0.6 }, storage);
		expect(values.has(PANE_LAYOUT_STORAGE_KEY)).toBe(true);
		expect(loadPaneLayout(storage)).toEqual({ registerWidth: 425, editorFraction: 0.6 });
	});
	it('rejects malformed values, clamps valid out-of-range dimensions, and tolerates storage denial', () => {
		const storage = (raw: string) => () => ({ getItem: () => raw, setItem: () => {} });
		for (const value of ['not JSON', 'null', '{}', '{"registerWidth":"400","editorFraction":0.5}'])
			expect(loadPaneLayout(storage(value))).toBeUndefined();
		expect(loadPaneLayout(storage('{"registerWidth":-50,"editorFraction":2}'))).toEqual({
			registerWidth: 260,
			editorFraction: 1
		});
		const denied = () => {
			throw new Error('Storage denied');
		};
		expect(loadPaneLayout(denied)).toBeUndefined();
		expect(() =>
			savePaneLayout({ registerWidth: 300, editorFraction: 0.75 }, denied)
		).not.toThrow();
	});
});
