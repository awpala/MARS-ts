<script lang="ts" generics="T extends string">
  import type { Snippet } from 'svelte';
  import PaneTabs from '../controls/PaneTabs.svelte';
  import Pane from './Pane.svelte';
  /** Layout and tab contract; the caller owns selection, body state, and all resources. */
  type Props = {
    /** Required accessible region name. */
    label: string;
    /** Optional region ID for resize controls; absent by default. */
    id?: string;
    /** Optional CSS hook for the containing layout; empty by default. */
    class?: string;
    /** Region landmark; defaults to section, with aside available for sidebars. */
    element?: 'section' | 'aside';
    /** Required ordered tab labels. */
    tabs: readonly T[];
    /** Required parent-owned selected label, bindable. */
    selected: T;
    /** Required body template, receiving the selected tab. The caller decides whether bodies remain mounted. */
    children: Snippet<[T]>;
    /** Optional controls in the tab strip; omitted by default. */
    actions?: Snippet;
  };
  let {
    label,
    id,
    class: className = '',
    element = 'section',
    tabs,
    selected = $bindable(),
    children,
    actions
  }: Props = $props();
</script>

<!-- @component Tabbed specialization of Pane. Composes the generic tab strip with caller-owned selection and body content; geometry remains with the container. -->
<Pane {element} {id} {label} class={className}>
  <PaneTabs
    tabs={tabs.map((label) => ({ id: label, label }))}
    {selected}
    onselect={(tab) => (selected = tab)}
    {actions}
  />
  {@render children(selected)}
</Pane>
