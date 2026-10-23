<script lang="ts">
  import { Settings } from '#lib/engine/Settings.js';
  import { getDesktopCommands } from '../../context/commands.js';
  import {
    helpActions,
    memoryConfigurationAction,
    menus,
    unavailableTools,
    type Action
  } from '../../utils/commands/actions.js';
  import {
    clearAllOutputsOnGoOption,
    memoryConfigurationDescription,
    pendingSettings
  } from '../../utils/commands/settings.js';
  import DropdownMenu, { type MenuItem, type MenuGroup } from './DropdownMenu.svelte';
  import RegisterBanksToggle from './RegisterBanksToggle.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import GitHubLink from './GitHubLink.svelte';
  /** Commands and setting toggles come from the desktop command capability; only these two parent-owned preferences remain props. */
  type Props = {
    /** Required parent-owned visibility of the registers sidebar; bindable and shown by default in its owner. */
    showRegisters: boolean;
    /** Required parent-owned console-clearing preference; bindable and false by default in its owner. */
    clearAllOutputsOnGo: boolean;
  };
  let { showRegisters = $bindable(), clearAllOutputsOnGo = $bindable() }: Props = $props();
  const commands = getDesktopCommands();
  const groupName = $props.id();
  let element: HTMLElement;
  function actionItem(item: Action, tooltip?: string): MenuItem {
    const reason = commands.disabledReason(item);
    return {
      id: item.command,
      label: item.label,
      tooltip: tooltip ?? (reason && `${item.label} — ${reason}`),
      shortcut: item.shortcut,
      disabled: !commands.isEnabled(item),
      onselect: () => void commands.execute(item.command)
    };
  }
  /** Settings groups: the display toggles, assembly choices, execution choices, then the dialogs and pending entries. */
  const settingsGroups = $derived.by(() => {
    const groups: MenuGroup[] = [
      {
        id: 'display',
        items: commands
          .displayToggles()
          .filter((toggle) => toggle.inSettings)
          .map((toggle) => ({
            id: toggle.icon,
            label: toggle.menuLabel ?? toggle.label,
            tooltip: toggle.description,
            checked: toggle.active,
            disabled: toggle.disabled,
            onselect: toggle.toggle
          }))
      }
    ];
    let items: MenuItem[] = [];
    for (const option of commands.engineToggles()) {
      items.push({
        id: String(option.id),
        label: option.label,
        tooltip: option.description,
        checked: option.active,
        disabled: option.disabled,
        onselect: option.toggle
      });
      if (option.id === Settings.START_AT_MAIN) {
        items.push({
          id: 'clearAllOutputsOnGo',
          label: clearAllOutputsOnGoOption.label,
          tooltip: clearAllOutputsOnGoOption.description,
          checked: clearAllOutputsOnGo,
          onselect: () => (clearAllOutputsOnGo = !clearAllOutputsOnGo)
        });
      }
      if ([Settings.START_AT_MAIN, Settings.SELF_MODIFYING_CODE_ENABLED].includes(option.id)) {
        groups.push({ id: `engine-${option.id}`, items });
        items = [];
      }
    }
    groups.push({
      id: 'pending',
      items: [
        ...items,
        ...pendingSettings.map(({ label, description }) => ({
          id: label,
          label,
          tooltip: description,
          disabled: true
        })),
        actionItem(memoryConfigurationAction, memoryConfigurationDescription)
      ]
    });
    return groups;
  });

  const definitions = $derived([
    ...menus.map((menu) => ({
      label: menu.name,
      groups: menu.groups.map((actions, index) => ({
        id: `${menu.name}-${index}`,
        items: actions.map((action) => actionItem(action))
      }))
    })),
    { label: 'Settings', groups: settingsGroups, class: 'settings-menu' },
    {
      label: 'Tools',
      groups: [
        {
          id: 'tools',
          items: unavailableTools.map((label) => ({ id: label, label, disabled: true }))
        }
      ]
    },
    {
      label: 'Help',
      groups: [
        {
          id: 'overview',
          items: helpActions
            .filter((item) => ['help', 'about'].includes(item.command))
            .map((item) => actionItem(item))
        },
        {
          id: 'articles',
          items: helpActions
            .filter((item) => !['help', 'about'].includes(item.command))
            .map((item) => actionItem(item))
        }
      ]
    }
  ]);
  /** Close this bar's menus. Restore focus to the active summary before opening Help when requested by the desktop. */
  export function close(restoreFocus = false): void {
    element?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((menu) => {
      if (restoreFocus && menu.contains(document.activeElement))
        menu.querySelector('summary')?.focus();
      menu.open = false;
    });
  }
  function closeOutside(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Node)) return;
    element?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((menu) => {
      if (!menu.contains(target)) menu.open = false;
    });
  }
</script>

<!-- @component Desktop menu catalog rendered through generic dropdowns. Command context and preferences belong to its ancestor; DOM dismissal stays scoped to this bar. -->
<svelte:document onclick={closeOutside} />
<nav class="menubar" aria-label="Application menus" bind:this={element}>
  {#each definitions as menu (menu.label)}
    <DropdownMenu
      label={menu.label}
      groups={menu.groups}
      class={'class' in menu ? menu.class : undefined}
      {groupName}
    />
  {/each}
  <div class="ml-auto flex items-center gap-3">
    <RegisterBanksToggle bind:visible={showRegisters} />
    <ThemeToggle />
    <GitHubLink />
  </div>
</nav>

<style>
  .menubar {
    display: flex;
    gap: 1px;
    padding: 1px 4px;
    border-bottom: 1px solid var(--theme-border, #b0b0b0);
  }
</style>
