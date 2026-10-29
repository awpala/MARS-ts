<script module lang="ts">
  /** Theme-aware glyphs under `static/icons` for file actions, debugger actions, view toggles, and memory paging or sizing; each file exposes its artwork as `#icon`. */
  export type ToolbarIconName =
    | 'AutoSave'
    | 'CloseAll'
    | 'Import'
    | 'Dump'
    | 'Export'
    | 'ExportAll'
    | 'Assemble'
    | 'Go'
    | 'Step'
    | 'Backstep'
    | 'Previous'
    | 'Next'
    | 'ExpandDataSegment'
    | 'Pause'
    | 'Stop'
    | 'Reset'
    | 'ClearBreakpoints'
    | 'Breakpoints'
    | 'BreakpointsDisabled'
    | 'Labels'
    | 'Args'
    | 'Addresses'
    | 'Ascii'
    | 'Values'
    | 'Lines'
    | 'Input'
    | 'Exceptions'
    | 'Memory';
</script>

<script lang="ts">
  import { asset } from '$app/paths';
  /** Decorative toolbar icon; its owning button provides the accessible name and tooltip. */
  type Props = {
    /** Required glyph basename; this component owns no interaction or session state. */
    name: ToolbarIconName;
  };
  let { name }: Props = $props();
</script>

<!-- @component References a bundled glyph's `#icon` group, so its theme variables and current text color resolve from the page rather than the static file's light-theme fallbacks. The parent button owns labeling and state. -->
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  width="22"
  height="22"
  aria-hidden="true"
>
  <use href={`${asset(`icons/${name}.svg`)}#icon`} />
</svg>
