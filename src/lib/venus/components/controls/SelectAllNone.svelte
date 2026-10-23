<script lang="ts" generics="T extends string | number">
  import Button from './Button.svelte';

  /** Bulk selection actions; the caller owns available values and commits selection changes. */
  type Props = {
    /** Required unique available values in the order emitted by Select all. */
    values: readonly T[];
    /** Required caller-owned current selection; this component never mutates it. */
    value: readonly T[];
    /** Required callback receiving a fresh array with all available values or no values. */
    onchange: (value: T[]) => void;
  };
  let { values, value, onchange }: Props = $props();
  const allSelected = $derived(values.every((entry) => value.includes(entry)));
</script>

<!-- @component Reusable Select all / Select none button pair with selection-derived availability and theme-aware hover feedback. Callers own selection state and surrounding placement; --selection-action-padding adjusts button sizing. -->
<div class="flex gap-2">
  <Button
    variant="bordered"
    class="p-(--selection-action-padding,2px_8px)"
    disabled={allSelected}
    onclick={() => onchange([...values])}>Select all</Button
  >
  <Button
    variant="bordered"
    class="p-(--selection-action-padding,2px_8px)"
    disabled={value.length === 0}
    onclick={() => onchange([])}>Select none</Button
  >
</div>
