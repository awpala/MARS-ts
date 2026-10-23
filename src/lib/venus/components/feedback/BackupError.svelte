<script lang="ts">
  /** Persistence failure presentation; the caller owns error selection and clearing. */
  type Props = {
    /** Required caller-selected error text; empty text renders nothing. */
    message: string;
  };
  let { message }: Props = $props();
</script>

<!-- @component Desktop persistence failure alert; its parent supplies the highest-priority error. -->
{#if message}
  <p class="backup-error" role="alert">
    {message}
  </p>
{/if}

<style>
  .backup-error {
    margin: 8px 0;
    padding: 6px 10px;
    color: var(--theme-error, #8b1a1a);
    background: var(--theme-warning, #fff1db);
  }
</style>
