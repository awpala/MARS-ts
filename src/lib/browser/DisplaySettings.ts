/** Browser preference key for the working editor/display controls. */
export const DISPLAY_SETTINGS_STORAGE_KEY = 'mars-ts:display-settings:v1';

/** Persistent view preferences, independent of source documents and machine state. */
export interface DisplaySettings {
	/** Whether Execute displays the Labels pane. */
	showLabels: boolean;
	/** Whether the editor displays line numbers. */
	showLines: boolean;
	/** Whether register and memory values display in hexadecimal. */
	hexValues: boolean;
	/** Whether memory addresses display in hexadecimal. */
	hexAddresses: boolean;
	/** Legacy run-speed slider position, integer zero through forty. */
	speed: number;
}

type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;

function validate(value: unknown): DisplaySettings | undefined {
	if (!value || typeof value !== 'object') return;
	const data = value as Record<string, unknown>;
	if (
		typeof data.showLabels !== 'boolean' ||
		typeof data.showLines !== 'boolean' ||
		typeof data.hexValues !== 'boolean' ||
		typeof data.hexAddresses !== 'boolean' ||
		typeof data.speed !== 'number' ||
		!Number.isInteger(data.speed) ||
		data.speed < 0 ||
		data.speed > 40
	)
		return;
	return {
		showLabels: data.showLabels,
		showLines: data.showLines,
		hexValues: data.hexValues,
		hexAddresses: data.hexAddresses,
		speed: data.speed
	};
}

/** Reads a complete validated preference record; malformed data or unavailable storage uses the GUI defaults. */
export function loadDisplaySettings(
	storage: StorageAccess = () => window.localStorage
): DisplaySettings | undefined {
	try {
		const raw = storage().getItem(DISPLAY_SETTINGS_STORAGE_KEY);
		return raw === null ? undefined : validate(JSON.parse(raw));
	} catch {
		return undefined;
	}
}

/** Stores only the working preference fields; blocked or full storage leaves in-memory settings usable. */
export function saveDisplaySettings(
	settings: DisplaySettings,
	storage: StorageAccess = () => window.localStorage
): void {
	const value = validate(settings);
	if (!value) return;
	try {
		storage().setItem(DISPLAY_SETTINGS_STORAGE_KEY, JSON.stringify(value));
	} catch {
		/* Keep in-memory preferences when persistence is unavailable. */
	}
}
