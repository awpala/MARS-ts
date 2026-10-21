<script lang="ts">
  import { shortcutChords } from '../../utils/shortcuts.js';
  /** Presentation only; shortcut registration belongs to the owning interaction. */
  type Props = {
    /** Required shortcut text: plus-separated keys, with alternatives separated by " / ". */
    shortcut: string;
  };
  let { shortcut }: Props = $props();
  const chords = $derived(shortcutChords(shortcut));
</script>

<!-- @component Theme-aware keycaps with one readable accessible label for the complete shortcut. -->
<span class="shortcut">
  <span class="sr-only">{shortcut}</span>
  <span class="keys" aria-hidden="true">
    {#each chords as keys, index (keys.join('+'))}
      {#if index > 0}<span class="separator">/</span>{/if}
      {#each keys as key, keyIndex (key)}
        {#if keyIndex > 0}<span class="separator">+</span>{/if}
        <kbd>{key}</kbd>
      {/each}
    {/each}
  </span>
</span>

<style>
  .shortcut,
  .keys {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
  }
  .shortcut {
    color: var(--theme-muted, #55616f);
    font-size: 11px;
  }
  kbd {
    min-width: 18px;
    padding: 1px 4px;
    border: 1px solid var(--theme-border, #9ca6b0);
    border-radius: 3px;
    background: var(--theme-canvas, #fff);
    box-shadow: 0 1px 0 var(--theme-border, #9ca6b0);
    font: inherit;
    font-family: monospace;
    line-height: 1.3;
    text-align: center;
  }
  .separator {
    padding: 0 1px;
  }
</style>
