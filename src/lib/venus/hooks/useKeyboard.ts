import { onMount } from 'svelte';
import { on } from 'svelte/events';

/** Lifetime and dispatch policy for a component's window keyboard handler. */
export type KeyboardOptions = {
  /** Read current interaction state on each event; enabled by default. */
  enabled?: () => boolean;
  /** Listen before focused controls; false by default. */
  capture?: boolean;
  /** Deliver held-key repeats; false by default. */
  allowRepeat?: boolean;
};

/**
 * Register a keyboard handler during component initialization and release it on unmount.
 * Ignores composition, AltGraph, and already-handled events. The caller explicitly matches
 * shortcuts, decides which editing surfaces/dialogs allow them, and cancels accepted events.
 * Unlike a page-level shortcut hook, this does not exclude the IDE's source textarea.
 */
export function useKeyboard(
  handler: (event: KeyboardEvent) => void,
  { enabled = () => true, capture = false, allowRepeat = false }: KeyboardOptions = {}
): void {
  onMount(() =>
    on(
      window,
      'keydown',
      (event) => {
        if (
          !enabled() ||
          event.defaultPrevented ||
          event.isComposing ||
          event.getModifierState('AltGraph') ||
          (!allowRepeat && event.repeat)
        )
          return;
        handler(event);
      },
      { capture }
    )
  );
}
