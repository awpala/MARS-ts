import { onMount } from 'svelte';
import { on } from 'svelte/events';
import { getDesktop } from '../context/desktop.js';
import { keyboardAction, physicalKeyAction } from '../utils/commands/actions.js';
import { useKeyboard } from './useKeyboard.js';
import type { Command } from '../utils/commands/commands.js';

/** Bind desktop shortcuts and the dirty-source unload guard to the providing component's lifetime. */
export function useDesktopKeyboard(
  closeMenus: () => void,
  highlightShortcut: (command: Command) => void
): void {
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
      if (item.command === 'cut' || item.command === 'copy' || item.command === 'paste') {
        const source = workspace.sourceInput;
        if (!desktop.ready || desktop.hasModal || !source || !desktop.enabled(item)) return;
        if (event.target !== source) {
          const target = event.target;
          if (
            !(target instanceof HTMLElement) ||
            target.isContentEditable ||
            target.closest('input, textarea, select') ||
            window.getSelection()?.isCollapsed === false
          )
            return;
          closeMenus();
          source.focus({ preventScroll: true });
        }
        // Let the platform deliver its trusted clipboard event, including when async access is denied.
        highlightShortcut(item.command);
        return;
      }
      // The remaining desktop shortcuts own the chord even in a text field or when disabled.
      event.preventDefault();
      event.stopPropagation();
      if (!desktop.ready || desktop.hasModal || (event.repeat && item.noRepeat)) return;
      if (desktop.enabled(item)) {
        if (
          /^F\d+$/.test(event.key) ||
          item.command === 'clearOutput' ||
          item.command === 'clearAllOutput'
        )
          highlightShortcut(item.command);
        void desktop.execute(item.command);
      }
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
