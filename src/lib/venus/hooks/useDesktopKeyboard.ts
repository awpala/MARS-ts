import { onMount } from 'svelte';
import { on } from 'svelte/events';
import { getDesktop } from '../context/desktop.js';
import { consoleActions, fileActions, keyboardAction } from '../utils/commands.js';
import { useKeyboard } from './useKeyboard.js';

// Physical keys cover Option characters and dead/composition events before inputs consume them.
function physicalOptionAction(event: KeyboardEvent) {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const command =
    event.code === 'KeyN'
      ? 'new'
      : event.code === 'KeyL'
        ? 'clearAllOutput'
        : event.code === 'KeyW'
          ? 'close'
          : undefined;
  return command
    ? [...fileActions, ...consoleActions].find((action) => action.command === command)
    : undefined;
}

/** Bind desktop shortcuts and the dirty-source unload guard to the providing component's lifetime. */
export function useDesktopKeyboard(closeMenus: () => void): void {
  const desktop = getDesktop();
  const { workspace } = desktop;
  useKeyboard(
    (event) => {
      const item = physicalOptionAction(event) ?? keyboardAction(event);
      if (!item) {
        if (desktop.ready && !desktop.hasModal && event.key === 'Escape') closeMenus();
        return;
      }
      // Every defined shortcut belongs to the app, including in text fields and when disabled.
      event.preventDefault();
      event.stopPropagation();
      if (
        !desktop.ready ||
        desktop.hasModal ||
        (event.repeat && ['new', 'close'].includes(item.command))
      )
        return;
      if (desktop.enabled(item)) void desktop.execute(item.command);
    },
    {
      capture: true,
      allowRepeat: true,
      allowModifiedInput: (event) => physicalOptionAction(event) !== undefined
    }
  );
  onMount(() =>
    on(window, 'beforeunload', (event) => {
      if (workspace.tabs.some((tab) => workspace.editor.isDirty(tab))) event.preventDefault();
    })
  );
}
