<script module lang="ts">
  /** Memory paging glyphs adapt static/icons/Previous.svg and Next.svg.
   * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license. */
  /** SVG glyph names for file actions, debugger actions, view toggles, and memory paging or sizing. */
  export type ToolbarIconName =
    | 'autoSave'
    | 'import'
    | 'export'
    | 'exportAll'
    | 'assemble'
    | 'go'
    | 'step'
    | 'backstep'
    | 'previousMemoryPage'
    | 'nextMemoryPage'
    | 'expandDataSegment'
    | 'pause'
    | 'stop'
    | 'reset'
    | 'clearBreakpoints'
    | 'breakpoints'
    | 'breakpointsDisabled'
    | 'labels'
    | 'addresses'
    | 'ascii'
    | 'values'
    | 'lines'
    | 'input';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  /** Decorative toolbar icon; its owning button provides the accessible name and tooltip. */
  type Props = {
    /** Required glyph name; this component owns no interaction or session state. */
    name: ToolbarIconName;
  };
  let { name }: Props = $props();
  const glyphs: Record<ToolbarIconName, Snippet> = {
    autoSave: autoSaveGlyph,
    import: importGlyph,
    export: exportIcon,
    exportAll: exportAllIcon,
    go: goGlyph,
    pause: pauseGlyph,
    stop: stopGlyph,
    reset: resetGlyph,
    clearBreakpoints: clearBreakpointsGlyph,
    breakpoints: breakpointsGlyph,
    breakpointsDisabled: breakpointsDisabledGlyph,
    step: stepGlyph,
    backstep: backstepGlyph,
    previousMemoryPage: previousMemoryPageIcon,
    nextMemoryPage: nextMemoryPageIcon,
    expandDataSegment: expandDataSegmentGlyph,
    assemble: assembleGlyph,
    labels: labelsGlyph,
    addresses: addressesGlyph,
    ascii: asciiGlyph,
    values: valuesGlyph,
    lines: linesGlyph,
    input: inputGlyph
  };
</script>

{#snippet autoSaveGlyph()}
  <path
    d="M3 3h13l5 5v13H3ZM7 3v6h9V3M7 21v-8h10v8m-7-5 2 2 4-4"
    stroke="var(--theme-icon-blue, #236ba5)"
  />
{/snippet}

{#snippet importGlyph()}
  <path
    d="M4 3h10l5 5v13H4ZM14 3v5h5M1 12h12m-4-4 4 4-4 4"
    stroke="var(--theme-icon-blue, #236ba5)"
  />
{/snippet}

{#snippet exportGlyph(all: boolean)}
  {#if all}<path d="M2 4v18h15" />{/if}
  <path
    d="M6 2h10l5 5v6M16 2v5h5M6 2v17h5M16 12v9m-4-4 4 4 4-4"
    stroke="var(--theme-icon-green, #278443)"
  />
{/snippet}

{#snippet exportIcon()}
  {@render exportGlyph(false)}
{/snippet}

{#snippet exportAllIcon()}
  {@render exportGlyph(true)}
{/snippet}

{#snippet goGlyph()}
  <path
    d="M7 4 20 12 7 20Z"
    fill="var(--theme-icon-green, #278443)"
    stroke="var(--theme-icon-green, #278443)"
  />
{/snippet}

{#snippet pauseGlyph()}
  <path d="M8 5v14M16 5v14" stroke="var(--theme-icon-blue, #236ba5)" stroke-width="3" />
{/snippet}

{#snippet stopGlyph()}
  <rect
    x="5"
    y="5"
    width="14"
    height="14"
    rx="1"
    fill="var(--theme-icon-red, #bc4141)"
    stroke="var(--theme-icon-red, #bc4141)"
  />
{/snippet}

{#snippet resetGlyph()}
  <path d="M5 9a8 8 0 1 1 0 7M5 3v6h6" stroke="var(--theme-icon-green, #278443)" />
{/snippet}

{#snippet clearBreakpointsGlyph()}
  <circle cx="9" cy="10" r="6" stroke="var(--theme-icon-red, #bc4141)" />
  <path d="m15 15 6 6m0-6-6 6" />
{/snippet}

{#snippet breakpointsGlyph()}
  <circle
    cx="12"
    cy="12"
    r="7"
    fill="var(--theme-icon-red, #bc4141)"
    stroke="var(--theme-icon-red, #bc4141)"
  />
{/snippet}

{#snippet breakpointsDisabledGlyph()}
  <circle cx="12" cy="12" r="7" stroke="var(--theme-muted, #697681)" />
  <path d="m3 3 18 18" stroke="var(--theme-muted, #697681)" />
{/snippet}

{#snippet stepGlyph()}
  <path d="M12 3v12m-5-5 5 5 5-5M5 20h14" stroke="var(--theme-icon-blue, #236ba5)" />
{/snippet}

{#snippet backstepGlyph()}
  <path d="M10 4 5 9l5 5M5 9h9a5 5 0 0 1 0 10h-3" stroke="var(--theme-icon-blue, #236ba5)" />
{/snippet}

{#snippet previousMemoryPageGlyph(previous: boolean)}
  <path
    d={previous ? 'M2 12 12 3v6h10v6H12v6Z' : 'M22 12 12 3v6H2v6h10v6Z'}
    fill="var(--theme-icon-green, #88be47)"
    stroke="var(--theme-icon-green, #4f7f20)"
    stroke-width="1"
  />
{/snippet}

{#snippet previousMemoryPageIcon()}
  {@render previousMemoryPageGlyph(true)}
{/snippet}

{#snippet nextMemoryPageIcon()}
  {@render previousMemoryPageGlyph(false)}
{/snippet}

{#snippet expandDataSegmentGlyph()}
  <path d="M12 20V5M5 12l7-7 7 7" />
{/snippet}

{#snippet assembleGlyph()}
  <g transform="rotate(40 12 12) translate(24 0) scale(-1 1)" stroke-width="1.3">
    <rect
      x="10"
      y="9"
      width="4"
      height="12"
      rx="1"
      fill="var(--theme-icon-wood, #b17b45)"
      stroke="var(--theme-icon-outline, #724a27)"
    />
    <path
      d="M4 5h11c3 0 5 2 5 5l-4-2-2 3H4Z"
      fill="var(--theme-icon-metal, #66849c)"
      stroke="var(--theme-icon-outline, #344b5d)"
    />
    <path d="M7 5v6" stroke="var(--theme-icon-outline, #344b5d)" />
  </g>
{/snippet}

{#snippet labelsGlyph()}
  <path d="M3 4h8l10 10-7 7L3 10Z" /><circle cx="7" cy="8" r="1" />
{/snippet}

{#snippet addressesGlyph()}
  <path d="M9 9a4 4 0 1 0-8 0c0 3 4 6 4 6s4-3 4-6Z" />
  <circle cx="5" cy="8" r="1" />
  <text
    x="10"
    y="18"
    fill="currentColor"
    stroke="none"
    font-family="monospace"
    font-size="11"
    font-weight="bold">0x</text
  >
{/snippet}

{#snippet asciiGlyph()}
  <text
    x="2"
    y="17"
    fill="currentColor"
    stroke="none"
    font-family="monospace"
    font-size="13"
    font-weight="bold">Aa</text
  >
{/snippet}

{#snippet valuesGlyph()}
  <path d="M3 4h18v16H3ZM3 9h18M8 9v11" />
  <text
    x="10"
    y="17"
    fill="currentColor"
    stroke="none"
    font-family="monospace"
    font-size="9"
    font-weight="bold">0x</text
  >
{/snippet}

{#snippet linesGlyph()}
  <path d="M10 5h11M10 12h11M10 19h11" />
  {#each [1, 2, 3] as line (line)}
    <text
      x="2"
      y={line * 7 + 1}
      fill="currentColor"
      stroke="none"
      font-family="monospace"
      font-size="8">{line}</text
    >
  {/each}
{/snippet}

{#snippet inputGlyph()}
  <path d="M3 4h18v14h-9l-5 3v-3H3ZM3 8h18M7 12h1m3 0h6M7 15h10" />
{/snippet}

<!-- @component Compact file, debugger, display, and memory-navigation SVG glyphs. The parent button owns labeling and state. -->
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  width="22"
  height="22"
  aria-hidden="true"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  {@render glyphs[name]()}
</svg>
