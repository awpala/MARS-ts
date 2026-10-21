<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  /** Editable machine-value contract; the owner validates, writes, and reformats the value from its change handler. */
  type Props = Omit<HTMLInputAttributes, 'type' | 'children' | 'onkeydown'> & {
    /** Required accessible name, such as `Memory 0x10010000`; value cells have no visible label. */
    'aria-label': string;
    /** Smallest rendered width as a CSS length; defaults to `94px` so a hexadecimal word stays visible while the input fills its cell. */
    minWidth?: string;
  };
  let { minWidth = '94px', class: className, ...attributes }: Props = $props();

  function commitOnEnter(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    // Blurring fires the native change event, so the owner's handler validates and writes the value.
    if (event.key === 'Enter') event.currentTarget.blur();
  }
</script>

<!-- @component Borderless machine-value input that fills a MachineTable cell. Enter commits by blurring; native readonly, disabled, value, and change handling pass through to the owner. -->
<input
  {...attributes}
  class={['cell-input', className]}
  style:min-width={minWidth}
  onkeydown={commitOnEnter}
/>

<style>
  .cell-input {
    width: 100%;
    border: 0;
    background: transparent;
    font: inherit;
    /* Follow the cell, so numeric cells right-align their editable values. */
    text-align: inherit;
  }
  .cell-input:focus {
    outline: 1px solid var(--theme-focus, #467ca8);
    background: var(--theme-canvas, white);
  }
</style>
