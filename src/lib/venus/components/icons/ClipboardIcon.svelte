<script lang="ts">
  import { asset } from '$app/paths';
  import MaskIcon from './MaskIcon.svelte';
  /** Decorative Clipboard action icon; the owning button supplies the accessible name. */
  type Props = {
    /** Required Clipboard variant whose action the icon depicts; this component owns no state. */
    variant: 'copy-code' | 'transfer-to-file';
  };
  let { variant }: Props = $props();
</script>

<!-- @component 18-pixel Clipboard action icon from `static/icons`: Copy passes through as its full-color image, and the new-file transfer glyph follows the current text color. -->
{#if variant === 'copy-code'}
  <img src={asset('icons/Copy.svg')} width="18" height="18" alt="" />
{:else}
  <MaskIcon name="OpenAsNewFile" size={18} />
{/if}
