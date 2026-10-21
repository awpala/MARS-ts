<script lang="ts">
  import { asset } from '$app/paths';
  import type { AssetPath } from '$app/types';
  import type { ClassValue } from 'svelte/elements';
  /** Basenames of the SVG files bundled under `static/icons`. */
  type IconName<Path = AssetPath> = Path extends `icons/${infer Name}.svg` ? Name : never;
  /** Decorative static icon tinted with the surrounding text color; the owning control supplies its accessible name. */
  type Props = {
    /** Required basename of a bundled SVG under `static/icons`, without its extension. */
    name: IconName;
    /** Required square size in pixels. */
    size: number;
    /** Optional classes on the icon element; none by default. */
    class?: ClassValue;
  };
  let { name, size, class: className }: Props = $props();
</script>

<!-- @component Current-color icon masking a bundled static SVG, hidden from assistive technology. Owns no interaction or state. -->
<span
  class={['mask-icon', className]}
  style:width={`${size}px`}
  style:height={`${size}px`}
  style:mask-image={`url("${asset(`icons/${name}.svg`)}")`}
  aria-hidden="true"
></span>

<style>
  .mask-icon {
    display: inline-block;
    background: currentColor;
    mask-position: center;
    mask-repeat: no-repeat;
    mask-size: contain;
  }
</style>
