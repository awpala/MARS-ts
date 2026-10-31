/** Open a native modal and return its component-owned close/focus-restoration cleanup. No element is retained at module scope. */
export function openModalDialog(dialog: HTMLDialogElement): () => void {
  const previous = document.activeElement;
  dialog.showModal();
  return () => {
    dialog.close();
    if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
  };
}
