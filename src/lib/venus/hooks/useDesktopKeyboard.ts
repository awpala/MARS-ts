import { onMount } from 'svelte';
import { on } from 'svelte/events';
import { getDesktop } from '../context/desktop.js';
import { keyboardAction } from '../utils/commands.js';
import { useKeyboard } from './useKeyboard.js';

/** Bind desktop shortcuts and the dirty-source unload guard to the providing component's lifetime. */
export function useDesktopKeyboard(closeMenus: () => void): void {
	const desktop = getDesktop();
	const { workspace, simulation } = desktop;
	useKeyboard(
		(event) => {
			if (
				!event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				(event.code !== 'KeyN' && event.key.toLowerCase() !== 'n') ||
				event.shiftKey
			)
				return;
			// Cancel Option+N before focused inputs start dead-key composition, including blocked repeats.
			event.preventDefault();
			event.stopPropagation();
			if (desktop.ready && !desktop.hasModal && !simulation.running && !event.repeat)
				void desktop.execute('new');
		},
		{ capture: true, allowRepeat: true }
	);
	useKeyboard(
		(event) => {
			if (desktop.hasModal) return;
			const target = event.target;
			// The source textarea accepts IDE commands; other typing surfaces retain native keys.
			if (
				target instanceof HTMLElement &&
				target !== workspace.sourceInput &&
				(target.isContentEditable ||
					target.matches('textarea, select') ||
					(target instanceof HTMLInputElement &&
						!['button', 'checkbox', 'radio', 'range', 'reset', 'submit'].includes(target.type)))
			)
				return;
			if (event.key === 'Escape') {
				closeMenus();
				return;
			}
			const item = keyboardAction(event);
			if (item && desktop.enabled(item)) {
				event.preventDefault();
				void desktop.execute(item.command);
			}
		},
		{ enabled: () => desktop.ready, allowRepeat: true }
	);
	onMount(() =>
		on(window, 'beforeunload', (event) => {
			if (workspace.tabs.some((tab) => workspace.editor.isDirty(tab))) event.preventDefault();
		})
	);
}
