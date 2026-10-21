<script lang="ts">
  import LinkedResource from '../controls/LinkedResource.svelte';
  import MaskIcon from './MaskIcon.svelte';
  const label = 'MARS-ts on GitHub (opens in a new tab)';
</script>

<!-- @component Theme-aware repository link beside the appearance control; opens GitHub in a separate tab. -->
<LinkedResource
  class="github-link"
  href="https://github.com/awpala/MARS-ts"
  tooltip={label}
  aria-label={label}
>
  <MaskIcon class="github-icon" name="GitHub" size={20} />
</LinkedResource>

<style>
  /* The anchor renders inside LinkedResource, so its scoped class is targeted explicitly. */
  :global(a.github-link) {
    display: grid;
    place-items: center;
    align-self: center;
    width: 28px;
    height: 28px;
    border: 1px solid transparent;
    color: var(--theme-text, #17202b);
  }
  :global(a.github-link:hover) {
    border-color: var(--theme-accent-border, #849eb5);
    background: var(--theme-hover, #dbe8f2);
  }
  :global(a.github-link:focus-visible) {
    outline: 2px solid var(--theme-accent-border, #849eb5);
    outline-offset: 1px;
  }
</style>
