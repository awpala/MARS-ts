<script lang="ts">
  import { tick } from 'svelte';
  import TabbedPane from '../layout/TabbedPane.svelte';
  import Button from '../controls/Button.svelte';
  import { MESSAGE_TABS } from '#lib/browser/DesktopSession.js';
  import { getDesktop } from '../../context/desktop.js';
  import { requireAction } from '../../utils/commands/actions.js';
  import { ariaKeyShortcuts } from '../../utils/commands/shortcuts.js';
  /** Momentary keyboard feedback supplied by the desktop. */
  type Props = {
    /** Command to highlight, or null when no shortcut is active. */
    highlightedShortcut: string | null;
  };
  let { highlightedShortcut }: Props = $props();
  const { simulation } = getDesktop();
  const outputText = $derived(
    simulation.messageTab === 'Mars Messages' ? simulation.messages : simulation.runIO
  );
  const clear = requireAction('clearOutput');
  const clearAll = requireAction('clearAllOutput');

  function followOutput(element: HTMLTextAreaElement) {
    $effect(() => {
      const text = outputText;
      let active = true;
      // Wait for the textarea value and console layout to reflect this output.
      void tick().then(() => {
        if (active && element.value === text) element.scrollTop = element.scrollHeight;
      });
      return () => {
        active = false;
      };
    });
  }

  function focusInput(element: HTMLTextAreaElement) {
    element.focus();
  }
</script>

<!-- @component Output and inline syscall input composed inside the reusable pane shell. The simulation owner supplies the console text and tab, completes pending input, and stops the run; typed input reaches it one way so the owner applies the newline and length-limit rules. -->
<TabbedPane
  class="messages"
  label="Messages and console"
  tabs={MESSAGE_TABS}
  bind:selected={simulation.messageTab}
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

    <Button
      tooltip="Clear all outputs"
      shortcut={clearAll.shortcut}
      variant="outlined"
      highlighted={highlightedShortcut === clearAll.command}
      class="clear-all mb-0.5 rounded-none px-3 py-px"
      aria-keyshortcuts={ariaKeyShortcuts(clearAll.shortcut!)}
      onclick={() => simulation.clearOutput(true)}>{clearAll.label}</Button
    >
  {/snippet}
  <textarea {@attach followOutput} readonly aria-label={simulation.messageTab} value={outputText}
  ></textarea>
  {#if simulation.consoleInputPending && simulation.messageTab === 'Run I/O'}<form
      class="console-input"
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
