<script lang="ts" generics="Value extends string">
  import type { Snippet } from 'svelte';
  import type { HTMLSelectAttributes } from 'svelte/elements';

  /** Native single-choice dropdown with caller-owned options, selection, labeling, and events. */
  type Props = Omit<HTMLSelectAttributes, 'value' | 'children' | 'multiple'> & {
    /** Required option content; callers provide stable values matching the selection's string type. */
    children: Snippet;
    /** Caller-owned selected value; bind to receive changes. Undefined lets the native control select its first option. */
    value?: Value;
  };
  let { children, value = $bindable(), ...attributes }: Props = $props();
</script>

<!-- @component Theme-aware native single-select with centralized field, option, hover, focus, and disabled styling. Adds no wrapper, so caller-provided labels and fieldsets retain native behavior; attributes and events pass through. Owns no workflow, persistence, or subscriptions. -->
<select {...attributes} bind:value>
  {@render children()}
</select>

<style>
  select {
    min-width: 0;
    max-width: 100%;
    padding: 4px 6px;
    border: 1px solid var(--theme-border, #9a9a9a);
    background: var(--theme-canvas, white);
    color: var(--theme-text, #17202b);
  }
  select:enabled:hover {
    border-color: var(--theme-accent-border, #849eb5);
  }
  select:focus-visible {
    outline: 2px solid var(--theme-focus, #2c679c);
    outline-offset: 1px;
  }
  select:disabled {
    color: var(--theme-disabled, #858585);
    opacity: 0.65;
  }
  select :global(option) {
    background: var(--theme-canvas, white);
    color: var(--theme-text, #17202b);
  }
</style>
