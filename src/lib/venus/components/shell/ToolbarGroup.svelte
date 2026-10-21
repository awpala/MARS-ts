<script lang="ts">
  import type { Snippet } from 'svelte';
  /** Toolbar subgroup contract; content and actions belong to the caller. */
  type Props = {
    /** Required accessible group name. */
    label: string;
    /** Required toolbar controls rendered in order. */
    children: Snippet;
  };
  let { label, children }: Props = $props();
</script>

<!-- @component Consistent toolbar grouping and separator for caller-supplied controls. -->
<div class="toolgroup" role="group" aria-label={label}>
  {@render children()}
</div>

<style>
  .toolgroup {
    display: flex;
    padding-right: 5px;
    border-right: 1px solid var(--theme-border, #aaa);
  }
  .toolgroup:last-of-type {
    border: 0;
  }
</style>
