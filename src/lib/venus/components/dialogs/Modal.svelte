<script lang="ts">
  import Button from '../controls/Button.svelte';
  import type { Snippet } from 'svelte';
  /** Contract for a same-tab modal. The caller owns its open state and content. */
  type Props = {
    /** Required accessible heading. */
    title: string;
    /** Required modal body; caller handles form submission. */
    children: Snippet;
    /** Required dismissal callback; removes the modal from its parent. */
    onclose: () => void;
    /** Optional selector for initial focus inside the dialog; defaults to the first body control. */
    initialFocus?: string;
  };
  let { title, children, onclose, initialFocus }: Props = $props();
  const id = $props.id();
  let backdropPointer: number | null = null;
  function outsideDialog(event: PointerEvent, dialog: HTMLDialogElement): boolean {
    const bounds = dialog.getBoundingClientRect();
    return (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    );
  }
  function attachDialog(dialog: HTMLDialogElement) {
    const previous = document.activeElement;
    dialog.showModal();
    dialog
      .querySelector<HTMLElement>(
        initialFocus ??
          '.dialog-body input:not([disabled]), .dialog-body button:not([disabled]), .dialog-body textarea:not([disabled])'
      )
      ?.focus({ preventScroll: !!initialFocus });
    return () => {
      dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }
</script>

<!-- @component Native same-tab dialog with focus containment, Escape/backdrop dismissal, and focus restoration. --modal-body-display and --modal-body-overflow allow callers to keep actions outside their own scrolling content. -->
<dialog
  {@attach attachDialog}
  aria-labelledby={id}
  onpointerdown={(event) => {
    backdropPointer =
      event.button === 0 && outsideDialog(event, event.currentTarget) ? event.pointerId : null;
  }}
  onpointerup={(event) => {
    const dismiss =
      backdropPointer === event.pointerId && outsideDialog(event, event.currentTarget);
    backdropPointer = null;
    if (dismiss) onclose();
  }}
  onpointercancel={() => {
    backdropPointer = null;
  }}
  oncancel={(event) => {
    event.preventDefault();
    onclose();
  }}
>
  <header>
    <h2 {id}>{title}</h2>
    <Button aria-label="Close dialog" onclick={onclose}>×</Button>
  </header>
  <div class="dialog-body">{@render children()}</div>
</dialog>

<style>
  dialog {
    margin: auto;
    width: var(--modal-width, min(560px, 90vw));
    max-height: 90dvh;
    border: 1px solid var(--theme-border, #6a7786);
    padding: 0;
    color: var(--theme-text, #17202b);
    background: var(--theme-surface, #f0f0f0);
    box-shadow: 0 8px 32px #0005;
  }
  dialog[open] {
    display: flex;
    flex-direction: column;
  }
  dialog::backdrop {
    background: #0005;
  }
  header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--theme-heading, #d9e4ef);
    padding: 5px 9px;
    border-bottom: 1px solid var(--theme-border, #94a3b8);
  }
  h2 {
    font-weight: 600;
  }
  .dialog-body {
    display: var(--modal-body-display, block);
    min-height: 0;
    padding: 16px;
    overflow: var(--modal-body-overflow, auto);
  }
</style>
