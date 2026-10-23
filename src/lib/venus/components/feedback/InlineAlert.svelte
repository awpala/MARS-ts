<script lang="ts">
  /** Pane-level failure presentation; the owning component retains the message and decides when it clears. */
  type Props = {
    /** Required current error text; empty text renders nothing. */
    message: string;
  };
  let { message }: Props = $props();
</script>

<!-- @component Error alert for a pane footer, rendered in the themed error color only while its owner's message is nonempty. -->
{#if message}<p role="alert">{message}</p>{/if}

<style>
  p {
    flex-shrink: 0;
    color: var(--theme-error, #a11);
    padding: 4px;
  }
</style>
