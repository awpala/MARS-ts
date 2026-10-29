<script lang="ts">
  import { getDesktop } from '../../context/desktop.js';
  import Button from '../controls/Button.svelte';
  import Modal from './Modal.svelte';
  import DialogActions from './DialogActions.svelte';
  import DialogField from './DialogField.svelte';
  const { simulation } = getDesktop();
  const request = $derived(simulation.dialogRequest);
  const typeName = $derived(
    request?.messageType === 0
      ? 'Error'
      : request?.messageType === 1
        ? 'Information'
        : request?.messageType === 2
          ? 'Warning'
          : request?.messageType === 3
            ? 'Question'
            : 'Message'
  );
  const title = $derived(
    request?.kind === 'confirm'
      ? 'Select an Option'
      : request?.kind === 'input'
        ? 'Input'
        : typeName
  );
  const dismiss = () => simulation.completeDialog(request?.kind === 'confirm' ? -1 : null);
</script>

<!-- @component Services 50–59 presented in the current tab; simulation owns the resolver, draft, and Stop lifecycle. -->
{#if request}
  {#key request}
    <Modal {title} onclose={dismiss}>
      <form
        onsubmit={(event) => {
          event.preventDefault();
          simulation.completeDialog(
            request?.kind === 'input'
              ? simulation.dialogText
              : request?.kind === 'confirm'
                ? 0
                : null
          );
        }}
      >
        <p class="my-2 break-words whitespace-pre-wrap">{request.message}</p>
        {#if request.kind === 'input'}
          <DialogField label="Value"
            ><input aria-label="Dialog input" bind:value={simulation.dialogText} /></DialogField
          >
        {/if}
        <DialogActions>
          {#if request.kind === 'confirm'}
            <Button type="submit">Yes</Button>
            <Button type="button" onclick={() => simulation.completeDialog(1)}>No</Button>
            <Button type="button" onclick={() => simulation.completeDialog(2)}>Cancel</Button>
          {:else}
            <Button type="submit">OK</Button>
            {#if request.kind === 'input'}<Button
                type="button"
                onclick={() => simulation.completeDialog(null)}>Cancel</Button
              >{/if}
          {/if}
          <Button type="button" onclick={simulation.stop}>Stop</Button>
        </DialogActions>
      </form>
    </Modal>
  {/key}
{/if}
