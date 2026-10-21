<script lang="ts">
  /* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
   * Ports the dialog in mars/venus/SettingsMemoryConfigurationAction.java. */
  import { getDesktop } from '../../context/desktop.js';
  import { Binary } from '#lib/engine/formatting/Binary.js';
  import Button from '../controls/Button.svelte';
  import RadioSelector from '../controls/RadioSelector.svelte';
  import Modal from './Modal.svelte';
  import DialogActions from './DialogActions.svelte';

  const desktop = getDesktop();
  const { simulation } = desktop;
  const configurations = simulation.machine!.memoryConfigurations;
  const initial = configurations.getCurrentConfiguration().getConfigurationIdentifier();
  const choices = [...configurations.getConfigurationsIterator()];
  const group = $props.id();
  let selected = $state(initial);
  const addresses = $derived.by(() => {
    const configuration = configurations.getConfigurationByName(selected)!;
    const names = configuration.getConfigurationItemNames();
    return configuration
      .getConfigurationItemValues()
      .map((value, index) => ({
        address: Binary.intToHexString(value),
        name: names[index]
      }))
      .sort((a, b) => {
        const left = a.address + a.name;
        const right = b.address + b.name;
        return left < right ? -1 : left > right ? 1 : 0;
      });
  });
  function close() {
    desktop.memoryConfigurationOpen = false;
  }
  function apply() {
    simulation.updateMemoryConfiguration(selected);
  }
</script>

<!-- @component Memory-layout preview with legacy Apply, Cancel, and opening-selection Reset semantics. Draft selection belongs to this mounted dialog; SimulationState owns committed machine settings and persistence. -->
<Modal
  title="MIPS Memory Configuration"
  onclose={close}
  initialFocus="input:checked"
  --modal-width="min(820px, 94vw)"
  --modal-body-display="flex"
  --modal-body-overflow="hidden"
>
  <div class="memory-settings">
    <div class="configuration">
      <fieldset>
        <legend>Configuration</legend>
        {#each choices as configuration (configuration.getConfigurationIdentifier())}
          <RadioSelector
            name={group}
            bind:selected
            value={configuration.getConfigurationIdentifier()}
            label={configuration.getConfigurationName()}
            class="py-1"
          />
        {/each}
      </fieldset>
      <table aria-label="Memory configuration addresses">
        <thead><tr><th>Address</th><th>Memory item</th></tr></thead>
        <tbody>
          {#each addresses as item (item.name)}
            <tr><td><code>{item.address}</code></td><td>{item.name}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div class="actions">
      <DialogActions>
        <Button
          tooltip="Apply current settings and close dialog"
          onclick={() => {
            apply();
            close();
          }}>Apply and Close</Button
        >
        <Button tooltip="Apply current settings now and leave dialog open" onclick={apply}
          >Apply</Button
        >
        <Button tooltip="Close dialog without applying current settings" onclick={close}
          >Cancel</Button
        >
        <Button
          tooltip="Reset to initial settings without applying"
          onclick={() => (selected = initial)}>Reset</Button
        >
      </DialogActions>
    </div>
  </div>
</Modal>

<style>
  .memory-settings {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 0;
  }
  .configuration {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 20px;
    align-items: start;
    min-height: 0;
    overflow: auto;
  }
  .actions {
    flex-shrink: 0;
  }
  @media (max-width: 640px) {
    .configuration {
      grid-template-columns: 1fr;
    }
  }

  fieldset {
    border: 1px solid var(--theme-border, #919191);
    padding: 8px 12px;
  }
  legend {
    padding: 0 4px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    text-align: left;
    padding: 2px 6px;
  }
  th {
    border-bottom: 1px solid var(--theme-border, #919191);
  }
  code {
    white-space: nowrap;
  }
</style>
