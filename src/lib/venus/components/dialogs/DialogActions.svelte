<script lang="ts">
  import type { Snippet } from 'svelte';
  /** Shared action-row layout; callers own button semantics, state, and callbacks. */
  type Props = {
    /** Required native action buttons, rendered inside the surrounding form when present. */
    children: Snippet;
    /** Optional left-aligned action group; omitted by default, with its button presentation owned by the caller. */
    leading?: Snippet;
  };
  let { children, leading }: Props = $props();
</script>

<!-- @component Theme-aware action layout shared by dialog variants; preserves native form submission. -->
<div class="dialog-actions">
  {#if leading}<div class="leading">{@render leading()}</div>{/if}
  {@render children()}
</div>

<style>
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }
  .dialog-actions > :global(button) {
    border: 1px solid var(--theme-border, #929eaa);
    background: var(--theme-surface, #f8f8f8);
    padding: 4px 13px;
  }
  .leading {
    margin-right: auto;
    align-self: center;
  }
</style>
