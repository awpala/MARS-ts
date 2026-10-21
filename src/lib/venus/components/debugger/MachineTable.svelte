<script module lang="ts">
  /**
   * Highlight roles a MachineTable paints on caller-rendered body rows or cells through `data-highlight`:
   * `pc` and `delay-slot` mark Text Segment rows, `memory` marks an edited Data Segment word cell, and
   * `register` marks the last-written register row. Mirrors the highlight categories of
   * mars/venus/SettingsHighlightingAction.java.
   */
  export type MachineHighlight = 'pc' | 'delay-slot' | 'memory' | 'register';
</script>

<script lang="ts">
  /**
   * Ports the shared table rendering of mars/venus/TextSegmentWindow.java, DataSegmentWindow.java,
   * LabelsWindow.java, RegistersWindow.java, Coprocessor0Window.java, and Coprocessor1Window.java.
   * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
   */
  import type { Snippet } from 'svelte';
  import type { ClassValue } from 'svelte/elements';
  import preset from '../../highlighting-preset.json';
  /** Machine-state table frame; callers own header cells, body sections, cell content, editing, scrolling, and geometry decisions. */
  type Props = {
    /** Required header cells (`<th>` elements) for the single sticky heading row rendered by this table. */
    header: Snippet;
    /** Required body sections: one or more `<tbody>` elements. Rows or cells may set `data-selected="true"` for label navigation selection, independently of machine changes, and `data-highlight` to a MachineHighlight; the table owns colors and preset enablement. Body cells may add the `numeric` class to right-align monospace numbers and hexadecimal words (including CellInput values) and the `identifier` class to bold the cell naming the row, such as an address, register, or label. */
    children: Snippet;
    /** Heading typeface: `interface` (default) uses the application font, while `table` uses the preset monospace font of the cells. */
    headingFont?: 'interface' | 'table';
    /** CSS padding for every heading and body cell; defaults to `2px 4px`. */
    cellPadding?: string;
    /** CSS line height for every row; defaults to `normal` for compact rows. */
    lineHeight?: string;
    /** Optional layout classes on the table element; none by default. */
    class?: ClassValue;
    /** Optional read-only binding of the rendered table height in pixels; zero until measured. */
    offsetHeight?: number;
  };
  let {
    header,
    children,
    headingFont = 'interface',
    cellPadding = '2px 4px',
    lineHeight = 'normal',
    class: className,
    offsetHeight = $bindable(0)
  }: Props = $props();
</script>

<!-- @component Striped machine-state table with a sticky heading row and the bundled highlighting preset, themed through semantic color tokens. Renders `<table>` as its root without a wrapper; callers keep any scroll container as its parent and must not pass `--custom-property` attributes, which would insert one. Callers may add layout styles to cells, while borders, padding, row or highlight colors, and the `numeric`/`identifier` cell roles belong to this table. -->
<table
  class={[
    'machine-table',
    {
      'table-headings': headingFont === 'table',
      'memory-highlighting': preset.data.enabled,
      'register-highlighting': preset.registers.enabled
    },
    className
  ]}
  bind:offsetHeight
  style:line-height={lineHeight}
  style:--cell-padding={cellPadding}
  style:--table-font={preset.fontFamily}
  style:--table-font-size={preset.fontSize}
  style:--even-background={`var(--theme-row-even, ${preset.evenRow.background})`}
  style:--even-foreground={`var(--theme-text, ${preset.evenRow.foreground})`}
  style:--odd-background={`var(--theme-canvas, ${preset.oddRow.background})`}
  style:--odd-foreground={`var(--theme-text, ${preset.oddRow.foreground})`}
  style:--pc-background={`var(--theme-pc, ${preset.text.background})`}
  style:--pc-foreground={`var(--theme-text, ${preset.text.foreground})`}
  style:--delay-background={`var(--theme-delay, ${preset.delaySlot.background})`}
  style:--delay-foreground={`var(--theme-text, ${preset.delaySlot.foreground})`}
  style:--memory-background={`var(--theme-data-changed, ${preset.data.background})`}
  style:--memory-foreground={`var(--theme-text, ${preset.data.foreground})`}
  style:--register-background={`var(--theme-register-changed, ${preset.registers.background})`}
  style:--register-foreground={`var(--theme-text, ${preset.registers.foreground})`}
>
  <thead><tr>{@render header()}</tr></thead>
  {@render children()}
</table>

<style>
  /* Caller snippets render the cells and body rows, so their selectors are global beneath this scoped table. */
  /* Separate borders keep each cell's border with the cell, so the sticky heading row leaves no gap. */
  .machine-table {
    --cell-border: 1px solid var(--theme-border, #bbb);
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    white-space: nowrap;
    font-size: var(--table-font-size);
  }
  .table-headings,
  .machine-table > :global(tbody) {
    font-family: var(--table-font);
  }
  .machine-table :global(:is(th, td)) {
    border-right: var(--cell-border);
    border-bottom: var(--cell-border);
    padding: var(--cell-padding);
  }
  .machine-table :global(:is(th, td):first-child) {
    border-left: var(--cell-border);
  }
  thead :global(th) {
    position: sticky;
    top: 0;
    border-top: var(--cell-border);
    background: var(--theme-chrome, #e5e5e5);
    font-weight: 400;
  }
  .machine-table :global(tbody tr:nth-child(odd)) {
    background: var(--even-background);
    color: var(--even-foreground);
  }
  .machine-table :global(tbody tr:nth-child(even)) {
    background: var(--odd-background);
    color: var(--odd-foreground);
  }
  /* Highlights match the stripe specificity and follow them, so a highlighted row always wins. */
  .machine-table :global(tbody tr[data-highlight='pc']) {
    background: var(--pc-background);
    color: var(--pc-foreground);
  }
  .machine-table :global(tbody tr[data-highlight='delay-slot']) {
    background: var(--delay-background);
    color: var(--delay-foreground);
  }
  .register-highlighting :global(tbody tr[data-highlight='register']) {
    background: var(--register-background);
    color: var(--register-foreground);
  }
  .memory-highlighting :global(tbody td[data-highlight='memory']) {
    background: var(--memory-background);
    color: var(--memory-foreground);
  }
  /* Label navigation selection remains visible across the tables when keyboard focus moves. */
  .machine-table :global(tbody :is(tr, td)[data-selected='true']) {
    background: var(--theme-selected, #c7dff7);
    color: var(--theme-text, #17202b);
    outline: 2px solid var(--theme-focus, #507b9f);
    outline-offset: -2px;
  }
  /* Right-aligned monospace numbers line up digit by digit for comparison. */
  .machine-table :global(td.numeric) {
    text-align: right;
  }
  .machine-table :global(td.identifier) {
    font-weight: 700;
  }
</style>
