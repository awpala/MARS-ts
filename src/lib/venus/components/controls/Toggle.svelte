<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ClassValue } from 'svelte/elements';
  import Button from './Button.svelte';

  /** Generic binary switch; callers own the meaning and persistence of its value. */
  type Props = {
    /** Required visible caption, also used as the accessible name unless overridden. */
    label: string;
    /** Bindable switch state; defaults to false. */
    checked?: boolean;
    /** Whether the switch is unavailable; defaults to false. */
    disabled?: boolean;
    /** Track semantics; neutral by default, or active/inactive fill colors for an on/off setting. */
    variant?: 'neutral' | 'active';
    /** Optional callback receiving the new state after any binding is updated. */
    onchange?: (checked: boolean) => void;
    /** Optional accessible name when the visible caption is abbreviated. */
    'aria-label'?: string;
    /** Optional themed hover and keyboard description. */
    tooltip?: string;
    /** Optional decorative track content; callers must hide decorative icons from assistive technology. */
    children?: Snippet;
    /** Optional layout classes on the caption-and-switch container. */
    class?: ClassValue;
  };
  let {
    label,
    checked = $bindable(false),
    disabled = false,
    variant = 'neutral',
    onchange,
    'aria-label': ariaLabel,
    tooltip,
    children,
    class: className
  }: Props = $props();
</script>

<!-- @component Generic labeled switch built on Button. Owns native keyboard activation and thumb presentation, with optional decorative content; it has no theme or storage policy. -->
<div class={['toggle-control', className]}>
  <span>{label}</span>
  <Button
    class={[
      'relative h-6 w-13 flex-[0_0_52px] self-center rounded-full border transition-colors duration-180',
      variant === 'active'
        ? checked
          ? 'border-(--theme-switch-active,#507b9f) bg-(--theme-switch-active,#507b9f) hover:enabled:bg-(--theme-switch-active-hover,#42698b)'
          : 'border-(--theme-border,#a2aab1) bg-(--theme-switch-inactive,#c1cad3) hover:enabled:bg-(--theme-switch-inactive-hover,#adb9c5)'
        : 'border-(--theme-accent-border,#849eb5) bg-(--theme-selected,#d6e1ea) hover:enabled:bg-(--theme-selected-hover,#c6dcef)'
    ]}
    role="switch"
    aria-label={ariaLabel ?? label}
    aria-checked={checked}
    {disabled}
    {tooltip}
    keepTooltipOnClick
    onclick={() => {
      checked = !checked;
      onchange?.(checked);
    }}
  >
    <span
      class={['thumb', { checked }]}
      style:background={variant === 'active' ? '#fff' : undefined}
      aria-hidden="true"
    ></span>
    {@render children?.()}
  </Button>
</div>

<style>
  .toggle-control {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--theme-text, white);
    box-shadow: 0 1px 3px #0004;
    transform: translateX(0);
    transition: transform 300ms ease-in-out;
    will-change: transform;
  }
  .thumb.checked {
    transform: translateX(28px);
  }
</style>
