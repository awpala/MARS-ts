<script lang="ts">
  import { getDesktop } from '../../context/desktop.js';
  import { getDesktopCommands } from '../../context/commands.js';
  import {
    helpActions,
    toolbarGroups,
    memoryConfigurationAction,
    type Action
  } from '../../utils/commands/actions.js';
  import IconButton from '../controls/IconButton.svelte';
  import SpeedSlider from './SpeedSlider.svelte';
  import ToolbarGroup from './ToolbarGroup.svelte';
  /** Commands and display toggles come from the desktop command capability; only these view-owned values remain props. */
  type Props = {
    /** Required line-number preference, bindable to its owner. */
    showLines: boolean;
    /** Required run-speed slider position (0–40), bindable to its owner. */
    speed: number;
    /** Required visibility gate; the desktop shows run speed only in Execute. */
    showSpeed: boolean;
    /** Momentary keyboard-activated command to highlight, or null when none. */
    highlightedShortcut: string | null;
  };
  let {
    showLines = $bindable(),
    speed = $bindable(),
    showSpeed,
    highlightedShortcut
  }: Props = $props();
  const commands = getDesktopCommands();
  const { display } = getDesktop();
</script>

<!-- @component Composes generic toolbar groups/buttons from shared command definitions, with a parent-owned run-speed slider. -->
{#snippet commandButton(item: Action)}
  {@const icon = item.icon!}
  {@const suspended =
    'glyph' in icon && icon.glyph === 'Breakpoints' && !commands.isPressed(item.command)}
  {@const reason = item.unavailable ? 'not yet available' : commands.disabledReason(item)}
  <IconButton
    label={item.label}
    tooltip={reason ? `${item.label} — ${reason}` : item.label}
    shortcut={item.shortcut}
    pressed={commands.isPressed(item.command)}
    highlighted={highlightedShortcut === item.command}
    disabled={!commands.isEnabled(item)}
    onclick={() => void commands.execute(item.command)}
    icon={suspended ? { glyph: 'BreakpointsDisabled' } : icon}
  />
{/snippet}
<div class="toolbar" aria-label="Toolbar">
  {#each toolbarGroups as group (group.id)}
    <ToolbarGroup label={group.label}>
      {#each group.actions as item (item.command)}{@render commandButton(item)}{/each}
      {#if group.id === 'edit'}
        <IconButton
          label="Show line numbers"
          icon={{ glyph: 'Lines' }}
          pressed={showLines}
          onclick={() => (showLines = !showLines)}
        />
        <IconButton
          label="Highlight current line"
          icon={{ glyph: 'Highlight' }}
          pressed={display.highlightCurrentLine}
          onclick={() => (display.highlightCurrentLine = !display.highlightCurrentLine)}
        />
      {/if}
    </ToolbarGroup>
  {/each}
  <ToolbarGroup label="Display settings">
    {#each commands.displayToggles() as toggle (toggle.icon)}
      <IconButton
        label={toggle.label}
        icon={{ glyph: toggle.icon }}
        pressed={toggle.active}
        disabled={toggle.disabled}
        onclick={toggle.toggle}
      />
    {/each}
    {@render commandButton(memoryConfigurationAction)}
  </ToolbarGroup>
  <ToolbarGroup label="Help actions">{@render commandButton(helpActions[0])}</ToolbarGroup>
  {#if showSpeed}<SpeedSlider bind:value={speed} />{/if}
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    padding: 3px;
    border-bottom: 1px solid var(--theme-border, #999);
  }
  .toolbar :global(button) {
    transition: opacity 0s 150ms;
  }
</style>
