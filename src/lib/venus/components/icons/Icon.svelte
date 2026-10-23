<script module lang="ts">
  import type { ToolbarIconName } from './ToolbarIcon.svelte';
  import type { IconName } from './MaskIcon.svelte';

  /** Visual content of an icon-only button: a theme-aware glyph, a full-color bundled image, or a bundled SVG tinted with the surrounding text color. */
  export type IconSource =
    | {
        /** Theme-aware glyph basename under `static/icons`. */
        glyph: ToolbarIconName;
      }
    | {
        /** Basename of a full-color bundled SVG under `static/icons`. */
        image: IconName;
      }
    | {
        /** Basename of a bundled SVG under `static/icons`, rendered in the current text color. */
        mask: IconName;
      };
</script>

<script lang="ts">
  import { asset } from '$app/paths';
  import MaskIcon from './MaskIcon.svelte';
  import ToolbarIcon from './ToolbarIcon.svelte';
  /** Decorative icon-button content; the containing control supplies the accessible name. */
  type Props = {
    /** Required icon source; this component owns no interaction or state. */
    icon: IconSource;
  };
  let { icon }: Props = $props();
</script>

<!-- @component Renders an icon source from `static/icons` at icon-button content sizes: 22-pixel theme-aware glyphs, 22-pixel full-color images passed through unchanged, and 12-pixel current-color masks. -->
{#if 'glyph' in icon}
  <ToolbarIcon name={icon.glyph} />
{:else if 'image' in icon}
  <img src={asset(`icons/${icon.image}.svg`)} alt="" width="22" height="22" />
{:else}
  <MaskIcon name={icon.mask} size={12} />
{/if}
