<script lang="ts">
  import { Settings } from '#lib/engine/Settings.js';
  import { getDesktopCommands } from '../../context/commands.js';
  import {
    menus,
    engineOptions,
    popupInputOption,
    pendingSettings,
    helpActions,
    type Action,
    type DisplayToggle
  } from '../../utils/commands.js';
  import DropdownMenu, { type MenuItem, type MenuGroup } from './DropdownMenu.svelte';
  import RegisterBanksToggle from './RegisterBanksToggle.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import GitHubLink from './GitHubLink.svelte';
  /** Preference controls remain parent-owned; command behavior comes from the desktop context. */
  type Props = {
    /** Required current display preferences with their owner callbacks. */
    displayToggles: readonly DisplayToggle[];
    /** Required parent-owned visibility of the registers sidebar; bindable and shown by default in its owner. */
    showRegisters: boolean;
    /** Required current engine setting values. */
    engineSettings: Readonly<Record<number, boolean>>;
    /** Required execution state, used to disable engine setting changes. */
    running: boolean;
    /** Required callback writes settings through the parent machine. */
    onsetting: (id: number, value: boolean) => void;
  };
  let {
    displayToggles,
    engineSettings,
    running,
    onsetting,
    showRegisters = $bindable()
  }: Props = $props();
  const commands = getDesktopCommands();
  const groupName = $props.id();
  let element: HTMLElement;
  function actionItem(item: Action): MenuItem {
    return {
      id: item.command,
      label: item.label,
      shortcut: item.shortcut,
      disabled: !commands.isEnabled(item),
      onselect: () => void commands.execute(item.command)
    };
  }
  const settingsGroups = $derived.by(() => {
    const groups: MenuGroup[] = [
      {
        id: 'display',
        items: ['labels', 'input', 'addresses', 'values'].flatMap((icon) =>
          displayToggles
            .filter((toggle) => toggle.icon === icon)
            .map((toggle) => ({
              id: icon,
              label: toggle.label + (icon === 'input' ? ' (5,6,7,8,12)' : ''),
              checked: toggle.active,
              disabled: toggle.disabled,
              onselect: toggle.toggle
            }))
        )
      }
    ];
    let items: MenuItem[] = [];
    for (const option of engineOptions.filter((entry) => entry !== popupInputOption)) {
      items.push({
        id: String(option.id),
        label: option.label,
        checked: engineSettings[option.id] ?? false,
        disabled: running,
        onselect: () => onsetting(option.id, !engineSettings[option.id])
      });
      if ([Settings.START_AT_MAIN, Settings.SELF_MODIFYING_CODE_ENABLED].includes(option.id)) {
        groups.push({ id: `engine-${option.id}`, items });
        items = [];
      }
    }
    groups.push({
      id: 'pending',
      items: [...items, ...pendingSettings.map((label) => ({ id: label, label, disabled: true }))]
    });
    return groups;
  });
  const tools = [
    'BHT Simulator',
    'Bitmap Display',
    'Data Cache Simulator',
    'Digital Lab Sim',
    'Floating Point Representation',
    'Instruction Counter',
    'Instruction Statistics',
    'Keyboard and Display MMIO Simulator',
    'Memory Reference Visualization',
    'MIPS X-Ray',
    'Mars Bot',
    'ScavengerHunt',
    'Screen Magnifier',
    'Introduction to Tools'
  ];

  const definitions = $derived([
    ...menus.map((menu) => ({
      label: menu.name,
      groups: [{ id: menu.name, items: menu.actions.map(actionItem) }]
    })),
    { label: 'Settings', groups: settingsGroups, class: 'settings-menu' },
    {
      label: 'Tools',
      groups: [{ id: 'tools', items: tools.map((label) => ({ id: label, label, disabled: true })) }]
    },
    {
      label: 'Help',
      groups: [
        {
          id: 'overview',
          items: helpActions
            .filter((item) => ['help', 'about'].includes(item.command))
            .map(actionItem)
        },
        {
          id: 'articles',
          items: helpActions
            .filter((item) => !['help', 'about'].includes(item.command))
            .map(actionItem)
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
