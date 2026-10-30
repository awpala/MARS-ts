<script lang="ts">
  import type { ClassValue } from 'svelte/elements';
  import Button from './Button.svelte';
  import Icon, { type IconSource } from '../icons/Icon.svelte';

  /** Square icon-only button; callers own the meaning, availability, and activation of its action. */
  type Props = {
    /** Required accessible name, also the tooltip unless `tooltip` overrides it. */
    label: string;
    /** Required icon; decorative, since the label names the button. */
    icon: IconSource;
    /** Square edge length: sm is 18px, md 22px, lg 29px; lg by default. */
    size?: 'sm' | 'md' | 'lg';
    /** Optional tooltip text replacing the label; the label by default. */
    tooltip?: string;
    /** Optional keyboard hint shown in the tooltip; does not register a shortcut. */
    shortcut?: string;
    /** Whether activation is unavailable; false by default. */
    disabled?: boolean;
    /** Current toggle value; omitted for momentary actions. */
    pressed?: boolean;
    /** Show momentary action feedback independently of toggle state; false by default. */
    highlighted?: boolean;
    /** Optional layout classes on the button; none by default. */
    class?: ClassValue;
    /** Required activation callback; owns any asynchronous work. */
    onclick: () => void;
  };
  let {
    label,
    icon,
    size = 'lg',
    tooltip,
    shortcut,
    disabled = false,
    pressed,
    highlighted = false,
    class: className,
    onclick
  }: Props = $props();
  const sizes = { sm: 'size-4.5', md: 'size-5.5', lg: 'size-7.25' } as const;
</script>

<!-- @component Compact icon-only button shared by toolbar actions, close affordances, and pane controls. Wraps Button with a transparent border, dimmed disabled state, toggle styling for pressed buttons, and a tooltip that defaults to the accessible name. -->
<Button
  class={[
    'grid shrink-0 place-items-center border border-transparent disabled:opacity-35 aria-pressed:border-(--theme-accent-border,#648eae) aria-pressed:bg-(--theme-selected,#c4ddef) aria-pressed:text-(--theme-accent-text,#164c75) aria-pressed:hover:enabled:bg-(--theme-selected-hover,#b1d1e8)',
    sizes[size],
    className
  ]}
  aria-label={label}
  aria-pressed={pressed}
  tooltip={tooltip ?? label}
  keepTooltipOnClick={pressed !== undefined}
  {shortcut}
  {highlighted}
  {disabled}
  {onclick}
>
  <Icon {icon} />
</Button>
