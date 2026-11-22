<script lang="ts">
  import { tick } from 'svelte';
  import TabbedPane from '../layout/TabbedPane.svelte';
  import Button from '../controls/Button.svelte';
  import { MESSAGE_TABS } from '#lib/browser/session/DesktopSession.js';
  import { getDesktop } from '../../context/desktop.js';
  import { requireAction } from '../../utils/commands/actions.js';
  import { ariaKeyShortcuts } from '../../utils/commands/shortcuts.js';
  /** Momentary keyboard feedback supplied by the desktop. */
  type Props = {
    /** Command to highlight, or null when no shortcut is active. */
    highlightedShortcut: string | null;
  };
  let { highlightedShortcut }: Props = $props();
  const { display, simulation } = getDesktop();
  const executeView = $derived(display.view === 'Execute');
  const selected = $derived(simulation.visibleMessageTab);
  const outputText = $derived(
    selected === 'Mars Messages' ? simulation.messages : simulation.runIO
  );
  const diagnosticRow = $derived(
    selected === 'Mars Messages' && simulation.selectedDiagnostic
      ? outputText.slice(0, simulation.selectedDiagnostic.start).split('\n').length - 1
      : null
  );
  const clear = requireAction('clearOutput');
  const clearAll = requireAction('clearAllOutput');

  function followOutput(element: HTMLTextAreaElement) {
    let previousText: string | undefined;
    let previousTab: string | undefined;
    $effect(() => {
      const text = outputText;
      const selection = selected === 'Mars Messages' ? simulation.selectedDiagnostic : null;
      const changed = text !== previousText || previousTab !== selected;
      previousText = text;
      previousTab = selected;
      let active = true;
      // Wait for the textarea value and console layout to reflect this output.
      void tick().then(() => {
        if (!active || element.value !== text) return;
        if (!selection) {
          if (changed) element.scrollTop = element.scrollHeight;
          return;
        }
        element.setSelectionRange(selection.start, selection.end);
        const row = text.slice(0, selection.start).split('\n').length - 1;
        const height = parseFloat(getComputedStyle(element).lineHeight);
        element.scrollTop = row * height - element.clientHeight / 2 + height;
      });
      return () => {
        active = false;
      };
    });
  }

  function navigateMessage(element: HTMLTextAreaElement) {
    if (selected === 'Mars Messages') simulation.selectDiagnostic(element.selectionStart, true);
  }

  function focusInput(element: HTMLTextAreaElement) {
    element.focus();
  }
</script>

<!-- @component Output and inline syscall input composed inside the reusable pane shell. The simulation owner supplies the console text and tab, completes pending input, and stops the run; typed input reaches it one way so the owner applies the newline and length-limit rules. -->
<TabbedPane
  class="messages"
  label="Messages and console"
  tabs={executeView ? MESSAGE_TABS : ['Mars Messages']}
  bind:selected={
    () => selected,
    (tab) => {
      if (executeView) simulation.messageTab = tab;
    }
  }
  --pane-min-height="80px"
>
  {#snippet actions()}
    <Button
      variant="outlined"
      highlighted={highlightedShortcut === clear.command}
      class="clear mb-0.5 ml-auto rounded-none px-3 py-px"
      tooltip="Clear selected output"
      shortcut={clear.shortcut}
      aria-keyshortcuts={ariaKeyShortcuts(clear.shortcut!)}
      onclick={() => simulation.clearOutput()}>{clear.label}</Button
    >

    {#if executeView}
      <Button
        tooltip="Clear all outputs"
        shortcut={clearAll.shortcut}
        variant="outlined"
        highlighted={highlightedShortcut === clearAll.command}
        class="clear-all mb-0.5 rounded-none px-3 py-px"
        aria-keyshortcuts={ariaKeyShortcuts(clearAll.shortcut!)}
        onclick={() => simulation.clearOutput(true)}>{clearAll.label}</Button
      >
    {/if}
  {/snippet}
  <textarea
    {@attach followOutput}
    readonly
    aria-label={selected}
    value={outputText}
    class={{ diagnostic: diagnosticRow !== null }}
    style:--diagnostic-row={diagnosticRow}
    wrap={selected === 'Mars Messages' ? 'off' : 'soft'}
    onclick={(event) => {
      if (event.currentTarget.selectionStart === event.currentTarget.selectionEnd)
        navigateMessage(event.currentTarget);
    }}
    onkeydown={(event) => {
      if (event.key === 'Enter' && selected === 'Mars Messages') {
        event.preventDefault();
        navigateMessage(event.currentTarget);
      }
    }}></textarea>
  {#if simulation.consoleInputPending && selected === 'Run I/O'}<form
      class="console-input"
      data-testid="console-input"
      onsubmit={(event) => {
        event.preventDefault();
        simulation.completeInput(true);
      }}
    >
      <label
        >Input <textarea
          {@attach focusInput}
          aria-label="Run input"
          rows="1"
          value={simulation.inputText}
          oninput={simulation.consoleInputChanged}></textarea></label
      ><Button variant="outlined" class="px-2 py-0.5" type="submit">Submit</Button><Button
        variant="outlined"
        class="px-2 py-0.5"
        onclick={simulation.stop}>Stop</Button
      >
    </form>{/if}
</TabbedPane>

<style>
  textarea {
    flex: 1;
    min-height: 0;
    background: var(--theme-canvas, white);
    padding: 6px;
    resize: none;
    font: 13px/1.4 monospace;
  }
  /* Keep the selected message visible when its source textarea takes focus. */
  textarea.diagnostic {
    background-image: linear-gradient(
      var(--theme-selection, #ffed9e),
      var(--theme-selection, #ffed9e)
    );
    background-repeat: no-repeat;
    background-attachment: local;
    background-position: left calc(6px + var(--diagnostic-row) * 1lh);
    background-size: 100% 1lh;
  }
  .console-input {
    display: flex;
    gap: 8px;
    padding: 4px 6px;
    background: var(--theme-chrome, #eee);
  }
  .console-input label {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
  }
  .console-input textarea {
    flex: 1;
    min-width: 0;
    min-height: 26px;
    border: 1px solid var(--theme-border, #aaa);
    background: var(--theme-canvas, white);
    resize: none;
  }
</style>
