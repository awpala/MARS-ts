/** Browser persistence key for the first version of the two desktop pane dividers. */
export const PANE_LAYOUT_STORAGE_KEY = 'mars-ts:panes:v1';

/** View-only pane preferences; they never belong to engine sessions. */
export interface PaneLayout {
	/** Desired register width in CSS pixels; viewport constraints are applied by the presenter. */
	registerWidth: number;
	/** Editor share of the left pane height, before minimum pane sizes are applied. */
	editorFraction: number;
}

type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;

function validate(value: unknown): PaneLayout | undefined {
	if (!value || typeof value !== 'object') return;
	const data = value as Record<string, unknown>;
	if (
		typeof data.registerWidth !== 'number' ||
		!Number.isFinite(data.registerWidth) ||
		typeof data.editorFraction !== 'number' ||
		!Number.isFinite(data.editorFraction)
	)
		return;
	return {
		registerWidth: Math.max(260, Math.round(data.registerWidth)),
		editorFraction: Math.max(0, Math.min(1, data.editorFraction))
	};
}

/** Reads validated layout preferences; unavailable storage or malformed data silently uses default layout. */
export function loadPaneLayout(
	storage: StorageAccess = () => window.localStorage
): PaneLayout | undefined {
	try {
		const raw = storage().getItem(PANE_LAYOUT_STORAGE_KEY);
		return raw === null ? undefined : validate(JSON.parse(raw));
	} catch {
		return undefined;
	}
}

/** Persists view preferences after a resize gesture; blocked or full storage never interrupts editing. */
export function savePaneLayout(
	layout: PaneLayout,
	storage: StorageAccess = () => window.localStorage
): void {
	const value = validate(layout);
	if (!value) return;
	try {
		storage().setItem(PANE_LAYOUT_STORAGE_KEY, JSON.stringify(value));
	} catch {
		/* Keep current in-memory layout when persistence is unavailable. */
	}
}
