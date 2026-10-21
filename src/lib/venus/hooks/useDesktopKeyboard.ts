import { onMount } from 'svelte';
import { on } from 'svelte/events';
import { getDesktop } from '../context/desktop.js';
import { consoleActions, fileActions, keyboardAction } from '../utils/commands.js';
import { useKeyboard } from './useKeyboard.js';

/** Bind desktop shortcuts and the dirty-source unload guard to the providing component's lifetime. */
export function useDesktopKeyboard(closeMenus: () => void): void {
	const desktop = getDesktop();
	const { workspace } = desktop;
	useKeyboard(
		(event) => {
			// Physical keys also match Option characters and dead keys before inputs consume them.
			const optionCommand =
				event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
					? event.code === 'KeyN'
						? 'new'
						: event.code === 'KeyL'
							? 'clearAllOutput'
							: undefined
					: undefined;
			const item = optionCommand
				? [...fileActions, ...consoleActions].find((action) => action.command === optionCommand)
				: keyboardAction(event);
			if (!item) {
				if (desktop.ready && !desktop.hasModal && event.key === 'Escape') closeMenus();
				return;
			}
			// Every defined shortcut belongs to the app, including in text fields and when disabled.
			event.preventDefault();
			event.stopPropagation();
			if (!desktop.ready || desktop.hasModal || (event.repeat && item.command === 'new')) return;
			if (desktop.enabled(item)) void desktop.execute(item.command);
		},
		{ capture: true, allowRepeat: true }
	);
	onMount(() =>
		on(window, 'beforeunload', (event) => {
			if (workspace.tabs.some((tab) => workspace.editor.isDirty(tab))) event.preventDefault();
		})
	);
}
