import { onMount } from 'svelte';
import { on } from 'svelte/events';
import { getDesktop } from '../context/desktop.js';
import { keyboardAction, physicalKeyAction } from '../utils/commands/actions.js';
import { useKeyboard } from './useKeyboard.js';

/** Bind desktop shortcuts and the dirty-source unload guard to the providing component's lifetime. */
export function useDesktopKeyboard(closeMenus: () => void): void {
  const desktop = getDesktop();
  const { workspace } = desktop;
  useKeyboard(
    (event) => {
      // Physical keys cover Option characters and dead/composition events before inputs consume them.
      const item = physicalKeyAction(event) ?? keyboardAction(event);
      if (!item) {
        if (desktop.ready && !desktop.hasModal && event.key === 'Escape') closeMenus();
        return;
      }
      // Every defined shortcut belongs to the app, including in text fields and when disabled.
      event.preventDefault();
      event.stopPropagation();
      if (!desktop.ready || desktop.hasModal || (event.repeat && item.noRepeat)) return;
      if (desktop.enabled(item)) void desktop.execute(item.command);
    },
    {
      capture: true,
      allowRepeat: true,
      allowModifiedInput: (event) => physicalKeyAction(event) !== undefined
    }
  );
  onMount(() =>
    on(window, 'beforeunload', (event) => {
      if (workspace.unsavedNames.length) event.preventDefault();
    })
  );
}
