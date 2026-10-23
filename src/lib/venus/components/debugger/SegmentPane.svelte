<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ClassValue } from 'svelte/elements';
  import Pane from '../layout/Pane.svelte';

  /** Execute-view pane frame; callers own the body, geometry choice, and everything the heading actions do. */
  type Props = {
    /** Required region name, shown as the pane heading. */
    label: string;
    /** Optional layout classes on the region; none by default. */
    class?: ClassValue;
    /** Required CSS flex sizing of the region. */
    flex: string;
    /** Optional accessible name for the heading when its actions would otherwise extend it; the heading text by default. */
    headingLabel?: string;
    /** Optional controls aligned to the heading's trailing edge; omitted by default. */
    actions?: Snippet;
    /** Required pane body below the heading. */
    children: Snippet;
  };
  let { label, class: className, flex, headingLabel, actions, children }: Props = $props();
</script>

<!-- @component Bordered Execute pane with a themed heading band and optional trailing actions. Provides the shared frame of the Text Segment, Labels, and Data Segment panes; body content, scrolling, and state belong to each pane. -->
<Pane class={['segment', className]} {label} {flex} height="auto" minHeight="0" overflow="hidden">
  <h2 class="flex shrink-0 items-center justify-between gap-1.5" aria-label={headingLabel}>
    {label}{@render actions?.()}
  </h2>
  {@render children()}
</Pane>

<style>
  h2 {
    background: var(--theme-heading, #dde4eb);
    border-bottom: 1px solid var(--theme-border, #a2aab1);
    padding: 3px 6px;
    font-weight: 600;
  }
</style>
