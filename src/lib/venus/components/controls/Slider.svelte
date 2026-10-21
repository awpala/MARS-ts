<script lang="ts">
  import type { ClassValue, HTMLInputAttributes } from 'svelte/elements';

  /** Labeled native range input; the caller owns its value, bounds, and optional value text. */
  type Props = Omit<
    HTMLInputAttributes,
    'type' | 'value' | 'children' | 'class' | 'min' | 'max' | 'step'
  > & {
    /** Required visible label; also the accessible name unless aria-label overrides it. */
    label: string;
    /** Required bindable numeric position; callers apply and persist changes. */
    value: number;
    /** Inclusive lower bound; defaults to zero. */
    min?: number;
    /** Inclusive upper bound; defaults to one hundred. */
    max?: number;
    /** Native step interval; defaults to one. Use any for unrestricted positions. */
    step?: number | 'any';
    /** Optional formatted value, shown after the label and exposed as aria-valuetext. */
    valueText?: string;
    /** Optional layout classes on the label; no additional classes by default. */
    class?: ClassValue;
  };
  let {
    label,
    value = $bindable(),
    min = 0,
    max = 100,
    step = 1,
    valueText,
    class: className,
    ...attributes
  }: Props = $props();
</script>

<!-- @component Generic labeled range control. Native keyboard input, disabled state, and events pass through; value formatting and persistence belong to the caller. -->
<label class={className}>
  {label}{valueText ? ` ${valueText}` : ''}
  <input
    {...attributes}
    type="range"
    {min}
    {max}
    {step}
    bind:value
    aria-label={attributes['aria-label'] ?? label}
    aria-valuetext={attributes['aria-valuetext'] ?? valueText}
  />
</label>

<style>
  input {
    display: block;
    width: 100%;
    height: var(--slider-height, 14px);
  }
</style>
