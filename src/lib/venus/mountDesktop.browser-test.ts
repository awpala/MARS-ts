import { mount, unmount } from 'svelte';
import VenusUI from './VenusUI.svelte';
import '../../routes/layout.css';

/** Mount the production desktop in an isolated browser-test page and return its real teardown. */
export function mountDesktop(target: HTMLElement): () => Promise<void> {
	const desktop = mount(VenusUI, { target });
	return () => unmount(desktop);
}
