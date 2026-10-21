<script lang="ts">
  import ToolbarIcon, { type ToolbarIconName } from './ToolbarIcon.svelte';
  import Button from '../controls/Button.svelte';
  /** Stateless toolbar control; caller provides labeling, enablement, and activation. */
  type Props = {
    /** Required accessible button label. */
    label: string;
    /** Optional tooltip, defaulting to the label. */
    title?: string;
    /** Optional keyboard shortcut shown as keycaps in the tooltip. */
    shortcut?: string;
    /** Required decorative image or SVG glyph. */
    icon: { glyph: ToolbarIconName } | { src: string };
    /** Disabled state; false by default. */
    disabled?: boolean;
    /** Current toggle value; omitted for momentary actions. */
    pressed?: boolean;
    /** Required activation callback; owns any asynchronous work. */
    onclick: () => void;
  };
  let { label, title, shortcut, icon, disabled = false, pressed, onclick }: Props = $props();
</script>

<!-- @component Toolbar specialization of the generic Button: compact icon layout, toolbar colors, and label-based tooltips. -->
<Button
  aria-label={label}
  aria-pressed={pressed}
  tooltip={title ?? label}
  keepTooltipOnClick={pressed !== undefined}
  {shortcut}
  {disabled}
  {onclick}
  class="grid size-7.25 place-items-center border border-transparent hover:enabled:border-(--theme-accent-border,#849eb5) hover:enabled:bg-(--theme-hover,#dbe8f2) disabled:opacity-35 aria-pressed:border-(--theme-accent-border,#648eae) aria-pressed:bg-(--theme-selected,#c4ddef) aria-pressed:text-(--theme-accent-text,#164c75) aria-pressed:hover:bg-(--theme-selected-hover,#b1d1e8)"
>
  {#if 'glyph' in icon}
    <ToolbarIcon name={icon.glyph} />
  {:else}
    <img src={icon.src} alt="" width="22" height="22" />
  {/if}
</Button>
