<script lang="ts">
  import Button from '../controls/Button.svelte';
  import SelectorToggle from '../controls/SelectorToggle.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import Modal from './Modal.svelte';
  import DialogActions from './DialogActions.svelte';
  const desktop = getDesktop();
  const { simulation, display } = desktop;
  const count = $derived(simulation.breakpoints.length);
  function close() {
    desktop.clearBreakpointsOpen = false;
  }
</script>

<!-- @component Clear all breakpoints confirmation; the desktop owns visibility, display preferences own the synced Keep showing this warning checkbox, and simulation owns the breakpoint list. -->
<Modal title="Clear all breakpoints?" onclose={close}>
  <p class="my-2">
    Remove all <strong>{count}</strong>
    {count === 1 ? 'breakpoint' : 'breakpoints'}?
  </p>
  <p class="my-2">To skip them during Go without removing them, use Toggle all breakpoints.</p>
  <DialogActions>
    {#snippet leading()}
      <SelectorToggle
        label="Keep showing this warning"
        bind:checked={display.promptClearBreakpoints}
      />
    {/snippet}
    <Button onclick={desktop.confirmClearBreakpoints}>Clear breakpoints</Button><Button
      onclick={close}>Cancel</Button
    >
  </DialogActions>
</Modal>
