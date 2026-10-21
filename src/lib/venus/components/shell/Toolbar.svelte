<script lang="ts">
  import { asset } from '$app/paths';
  import { getDesktopCommands } from '../../context/commands.js';
  import {
    toolbarGroups,
    helpActions,
    type Action,
    type DisplayToggle
  } from '../../utils/commands.js';
  import SpeedSlider from './SpeedSlider.svelte';
  import ToolbarButton from './ToolbarButton.svelte';
  import ToolbarGroup from './ToolbarGroup.svelte';
  /** Parent-owned display preferences; command state and execution come from desktop context. */
  type Props = {
    /** Required current display settings and their callbacks. */
    displayToggles: readonly DisplayToggle[];
    /** Required line-number preference, bindable to its owner. */
    showLines: boolean;
    /** Required run-speed slider position (0–40), bindable to its owner. */
    speed: number;
    /** Required visibility gate; the desktop shows run speed only in Execute. */
    showSpeed: boolean;
  };
  let { displayToggles, showLines = $bindable(), speed = $bindable(), showSpeed }: Props = $props();
  const commands = getDesktopCommands();
  const icons: Record<string, string> = {
    Previous: asset('icons/Previous.svg'),
    Paste: asset('icons/Paste.svg'),
    Redo: asset('icons/Redo.svg'),
    Next: asset('icons/Next.svg'),
    Open: asset('icons/Open.svg'),
    Dump: asset('icons/Dump.svg'),
    Help: asset('icons/Help.svg'),
    Find: asset('icons/Find.svg'),
    SaveAs: asset('icons/SaveAs.svg'),
    New: asset('icons/New.svg'),
    Undo: asset('icons/Undo.svg'),
    Save: asset('icons/Save.svg'),
    Copy: asset('icons/Copy.svg'),
    Cut: asset('icons/Cut.svg')
  };
</script>

<!-- @component Composes generic toolbar groups/buttons from shared command definitions, with a parent-owned run-speed slider. -->
{#snippet commandButton(item: Action)}
  <ToolbarButton
    label={item.label}
    title={item.unavailable ? `${item.label} — not yet available` : item.label}
    shortcut={item.shortcut}
    pressed={commands.isPressed(item.command)}
    disabled={!commands.isEnabled(item)}
    onclick={() => void commands.execute(item.command)}
    icon={item.debugIcon
      ? {
          glyph:
            item.debugIcon === 'breakpoints' && !commands.isPressed(item.command)
              ? 'breakpointsDisabled'
              : item.debugIcon
        }
      : { src: icons[item.icon ?? ''] }}
  />
{/snippet}
<div class="toolbar" aria-label="Toolbar">
  {#each toolbarGroups as group (group.id)}
    <ToolbarGroup label={group.label}>
      {#each group.actions as item (item.command)}{@render commandButton(item)}{/each}
      {#if group.id === 'edit'}
        <ToolbarButton
          label="Show line numbers"
          icon={{ glyph: 'lines' }}
          pressed={showLines}
          onclick={() => (showLines = !showLines)}
        />
      {/if}
    </ToolbarGroup>
  {/each}
  <ToolbarGroup label="Display settings">
    {#each displayToggles as toggle (toggle.icon)}
      <ToolbarButton
        label={toggle.label}
        icon={{ glyph: toggle.icon }}
        pressed={toggle.active}
        disabled={toggle.disabled}
        onclick={toggle.toggle}
      />
    {/each}
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
</style>
