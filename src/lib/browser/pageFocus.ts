/** Whether this page is visible and has system focus, so user input reaches it. */
export function pageActive(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus();
}

/**
 * Resolves as soon as the page is visible and has focus: immediately when it already does, otherwise on the focus or visibility
 * change that restores it. Browser and OS dialogs (file pickers, save prompts) take focus from the page and may return it late or
 * only on the next click, so callers holding a blocking status release it through this wait and add no delay of their own.
 */
export async function whenPageActive(): Promise<void> {
  while (!pageActive()) {
    await new Promise<void>((resolve) => {
      const done = () => {
        window.removeEventListener('focus', done);
        document.removeEventListener('visibilitychange', done);
        resolve();
      };
      window.addEventListener('focus', done);
      document.addEventListener('visibilitychange', done);
    });
  }
}
