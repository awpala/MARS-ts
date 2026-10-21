<script lang="ts">
  import { onMount } from 'svelte';
  import { saveTheme } from '#lib/browser/ThemePreference.js';
  import Toggle from '../controls/Toggle.svelte';
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
  <svg
    class="sun"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
  </svg>
  <svg
    class="moon"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    aria-hidden="true"
  >
    <path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z" />
  </svg>
</Toggle>

<style>
  svg {
    position: absolute;
    top: 5px;
    pointer-events: none;
  }
  .sun {
    left: 5px;
    color: var(--theme-text, #315e88);
  }
  .moon {
    right: 5px;
    color: var(--theme-background, #667);
  }
</style>
