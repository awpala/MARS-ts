import { describe, expect, it } from 'vitest';
import {
	DISPLAY_SETTINGS_STORAGE_KEY,
	loadDisplaySettings,
	saveDisplaySettings
} from './DisplaySettings.js';

const settings = {
	showLabels: true,
	showLines: false,
	hexValues: false,
	hexAddresses: false,
	speed: 12
};

describe('working display preference persistence', () => {
	it('round-trips false values and retains only the supported fields', () => {
		const values = new Map<string, string>();
		const storage = () => ({
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => {
				values.set(key, value);
			}
		});
		saveDisplaySettings({ ...settings, ...{ source: 'not a preference' } }, storage);
		expect(loadDisplaySettings(storage)).toEqual(settings);
		expect(JSON.parse(values.get(DISPLAY_SETTINGS_STORAGE_KEY)!)).toEqual(settings);
	});
	it('rejects partial, mistyped, and invalid slider data without coercing values', () => {
		for (const value of [
			null,
			{},
			{ ...settings, showLines: 'false' },
			{ ...settings, speed: -1 },
			{ ...settings, speed: 41 },
			{ ...settings, speed: 1.5 },
			{ ...settings, speed: '12' }
		]) {
			expect(
				loadDisplaySettings(() => ({ getItem: () => JSON.stringify(value), setItem: () => {} }))
			).toBeUndefined();
		}
		expect(
			loadDisplaySettings(() => ({ getItem: () => 'broken JSON', setItem: () => {} }))
		).toBeUndefined();
	});
	it('tolerates denied storage access and quota failures', () => {
		const denied = () => {
			throw new Error('Storage denied');
		};
		expect(loadDisplaySettings(denied)).toBeUndefined();
		expect(() => saveDisplaySettings(settings, denied)).not.toThrow();
		expect(() =>
			saveDisplaySettings(settings, () => ({
				getItem: () => null,
				setItem: () => {
					throw new Error('Quota exceeded');
				}
			}))
		).not.toThrow();
	});
});
