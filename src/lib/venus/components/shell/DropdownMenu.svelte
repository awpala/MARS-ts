<script module lang="ts">
  /** One rendered menu choice; the caller resolves session policy into this presentation record. */
  export type MenuItem = {
    /** Stable identity within the group. */
    id: string;
    /** Visible label. */
    label: string;
    /** Optional hover/focus description; omitted by default. */
    tooltip?: string;
    /** Optional keyboard hint; omitted by default. */
    shortcut?: string;
    /** Whether interaction is blocked; defaults to false. */
    disabled?: boolean;
    /** Checkbox value; omit for an ordinary command. */
    checked?: boolean;
    /** Optional activation callback; disabled placeholders may omit it. */
    onselect?: () => void;
  };
  /** A contiguous menu subgroup, separated from its neighbors by a rule. */
  export type MenuGroup = {
    /** Stable identity within the dropdown. */
    id: string;
    /** Ordered choices in this group. */
    items: readonly MenuItem[];
  };
</script>

<script lang="ts">
  import Button from '../controls/Button.svelte';
  import SelectorToggle from '../controls/SelectorToggle.svelte';
  import KeyboardShortcut from '../feedback/KeyboardShortcut.svelte';
  /** Caller-owned menu presentation; native details owns the open state. */
  type Props = {
    /** Required visible menu name. */
    label: string;
    /** Required ordered subgroups; empty subgroups are omitted. */
    groups: readonly MenuGroup[];
    /** Required native details group name, scoped to the owning menu bar. */
    groupName: string;
    /** Optional CSS hook on the popup; empty by default. */
    class?: string;
  };
  let { label, groups, groupName, class: className = '' }: Props = $props();
  const visibleGroups = $derived(groups.filter((group) => group.items.length));
</script>

<!-- @component Native dropdown rendering caller-supplied command and checkbox groups. -->
<details name={groupName} data-testid={`menu-${label.toLowerCase()}`}>
  <summary data-testid={`menu-${label.toLowerCase()}-trigger`}>{label}</summary>
  <div class={['menu', className]} data-testid={`menu-${label.toLowerCase()}-content`}>
    {#each visibleGroups as group, index (group.id)}
      {#if index > 0}<hr data-testid="menu-separator" />{/if}
      {#each group.items as item (item.id)}
        {@const testId = `menu-item-${item.id
          .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
          .replace(/[^a-zA-Z0-9]+/g, '-')
          .toLowerCase()}`}
        {#if item.checked !== undefined}
          <SelectorToggle
            {testId}
            label={item.label}
            checked={item.checked}
            tooltip={item.tooltip}
            disabled={item.disabled}
            onchange={item.onselect}
            class="w-full px-3 py-1.25 text-left whitespace-nowrap hover:bg-(--theme-hover,#c6dcef)"
          />
        {:else}
          <Button
            data-testid={testId}
            class="flex w-full items-center justify-between gap-2 px-3 py-1.25 text-left whitespace-nowrap"
            tooltip={item.tooltip}
            disabled={item.disabled}
            onclick={item.onselect}
          >
            <span>{item.label}</span>{#if item.shortcut}<KeyboardShortcut
                shortcut={item.shortcut}
              />{/if}
          </Button>
        {/if}
      {/each}
    {/each}
  </div>
</details>

<style>
  details {
    position: relative;
  }
  summary {
    list-style: none;
    padding: 3px 10px;
  }
  summary:hover,
  details[open] > summary {
    background: var(--theme-hover, #c6dcef);
  }
  .menu {
    --selector-gap: 8px;
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 20;
    min-width: 230px;
    padding: 3px;
    background: var(--theme-surface, #f5f5f5);
    border: 1px solid var(--theme-border, #919191);
    box-shadow: 2px 3px 5px #0003;
  }
  .menu hr {
    margin: 3px 4px;
    border: 0;
    border-top: 1px solid var(--theme-border, #919191);
  }
</style>
