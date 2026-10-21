<script lang="ts">
  /** Workflow failure presentation; the owning state retains the message and when it clears. */
  type Props = {
    /** Required current error text; empty text renders nothing. */
    message: string;
  };
  let { message }: Props = $props();
</script>

<!-- @component Dialog-scoped alert for a workflow failure, rendered only while its owner's message is nonempty. -->
{#if message}<p class="my-2" role="alert">{message}</p>{/if}
