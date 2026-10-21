<script module lang="ts">
  /** One stable choice in a checkbox selection group. */
  export type MultiSelectOption<T extends string | number> = {
    /** Unique value within the group; used for identity and membership. */
    value: T;
    /** Required visible text beside the checkbox. */
    label: string;
    /** Optional accessible name overriding an abbreviated visible label. */
    accessibleLabel?: string;
    /** Optional per-choice unavailability; defaults to false. */
    disabled?: boolean;
    /** Optional description shown on choice hover or focus; omitted by default. */
    tooltip?: string;
  };
</script>

<script lang="ts" generics="T extends string | number">
  import type { Snippet } from 'svelte';
  import type { ClassValue } from 'svelte/elements';
  import Tooltip from '../feedback/Tooltip.svelte';
  import SelectorToggle from './SelectorToggle.svelte';

  /** Labeled checkbox group; the caller owns options, selected values, and workflow policy. */
  type Props = {
    /** Required visible and accessible group caption. */
    label: string;
    /** Optional description shown on caption hover; omitted by default. */
    tooltip?: string;
    /** Required choices with unique values; their order determines the emitted selection order. */
    options: readonly MultiSelectOption<T>[];
    /** Bindable selected values; defaults to an empty selection. */
    value?: T[];
    /** Whether all choices are unavailable; defaults to false. */
    disabled?: boolean;
    /** Optional callback receiving the new ordered selection after any binding is updated. */
    onchange?: (value: T[]) => void;
    /** Choice layout, horizontal by default. */
    orientation?: 'horizontal' | 'vertical';
    /** Optional layout classes on the group. */
    class?: ClassValue;
    /** Optional classes on the choices container, such as scrolling and bounds. */
    optionsClass?: ClassValue;
    /** Optional content when there are no choices; omitted by default. */
    empty?: Snippet;
  };
  let {
    label,
    tooltip,
    options,
    value = $bindable([]),
    disabled = false,
    onchange,
    orientation = 'horizontal',
    class: className,
    optionsClass,
    empty
  }: Props = $props();
  const id = $props.id();

  function select(option: T, checked: boolean) {
    value = options
      .filter((entry) => (entry.value === option ? checked : value.includes(entry.value)))
      .map((entry) => entry.value);
    onchange?.(value);
  }
</script>

<!-- @component Generic group of labeled checkboxes, composed from SelectorToggle. Supports editable multi-selection and disabled status groups without domain or persistence state. -->
<div class={className} role="group" aria-labelledby={id}>
  {#if tooltip}
    <Tooltip text={tooltip}>
      {#snippet children(trigger, description)}
        <div {id} class="caption" {@attach trigger} aria-describedby={description}>{label}</div>
      {/snippet}
    </Tooltip>
  {:else}
    <div {id} class="caption">{label}</div>
  {/if}
  <div class={['options', orientation, optionsClass]}>
    {#each options as option (option.value)}
      <SelectorToggle
        label={option.label}
        aria-label={option.accessibleLabel}
        tooltip={option.tooltip}
        checked={value.includes(option.value)}
        disabled={disabled || option.disabled}
        onchange={(checked) => select(option.value, checked)}
      />
    {:else}
      {@render empty?.()}
    {/each}
  </div>
</div>

<style>
  .caption {
    margin-bottom: 5px;
  }
  .options {
    display: flex;
    gap: var(--multi-select-gap, 8px);
  }
  .horizontal {
    align-items: center;
  }
  .vertical {
    flex-direction: column;
  }
</style>
