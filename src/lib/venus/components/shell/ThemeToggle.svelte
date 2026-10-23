<script lang="ts">
  import { onMount } from 'svelte';
  import { saveTheme } from '#lib/browser/ThemePreference.js';
  import Toggle from '../controls/Toggle.svelte';
  import MaskIcon from '../icons/MaskIcon.svelte';
  let dark = $state(false);

  onMount(() => {
    dark = document.documentElement.dataset.theme === 'dark';
  });

  function toggle(checked: boolean) {
    dark = checked;
    const theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }
</script>

<!-- @component Browser-owned appearance toggle. Restores the pre-paint theme on mount; persists explicit choices independently of machine and editor state. -->
<Toggle
  class="theme-control my-0 mr-1 ml-auto"
  label="Theme:"
  aria-label="Dark theme"
  checked={dark}
  onchange={toggle}
  tooltip={dark ? 'Switch to light theme' : 'Switch to dark theme'}
>
  <MaskIcon class="sun" name="Sun" size={12} />
  <MaskIcon class="moon" name="Moon" size={12} />
</Toggle>

<style>
  /* The glyphs render inside MaskIcon within Toggle, so their classes are targeted explicitly. */
  :global(.theme-control .sun),
  :global(.theme-control .moon) {
    position: absolute;
    top: 5px;
    pointer-events: none;
  }
  :global(.theme-control .sun) {
    left: 5px;
    color: var(--theme-text, #315e88);
  }
  :global(.theme-control .moon) {
    right: 5px;
    color: var(--theme-background, #667);
  }
</style>
