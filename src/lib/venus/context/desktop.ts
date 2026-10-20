import { createContext } from 'svelte';
import type { DesktopState } from '../state/DesktopState.svelte.js';
import { setDesktopCommands } from './commands.js';

const [readDesktop, setDesktop] = createContext<DesktopState>();

/** Read the nearest desktop's domain owners; call during descendant component initialization. */
export const getDesktop = readDesktop;

/** Install one component-owned desktop and its narrower command capability; no global state is created. */
export function provideDesktop(desktop: DesktopState): DesktopState {
	setDesktop(desktop);
	setDesktopCommands({
		isEnabled: desktop.enabled,
		execute: desktop.execute,
		isPressed: desktop.isPressed
	});
	return desktop;
}
