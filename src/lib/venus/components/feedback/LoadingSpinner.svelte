<script lang="ts">
  /** Loading status presentation; visibility and initialization belong to the caller. */
  type Props = {
    /** Accessible visible status text; defaults to Loading…. */
    label?: string;
  };
  let { label = 'Loading…' }: Props = $props();
</script>

<!-- @component Accessible loading status with a continuously rotating spinner. The caller owns positioning and visibility. -->
<div class="loading-status" role="status">
  <span class="loading-spinner" aria-hidden="true"></span>
  <span>{label}</span>
</div>

<style>
  .loading-status {
    display: grid;
    justify-items: center;
    gap: 12px;
  }
  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--theme-border, #c4cbd2);
    border-top-color: var(--theme-focus, #315e88);
    border-radius: 50%;
    animation: loading-spin 0.8s linear infinite;
    will-change: transform;
  }
  @keyframes loading-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
