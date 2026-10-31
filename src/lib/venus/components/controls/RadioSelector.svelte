<script lang="ts">
  /** Native radio choice; the caller owns the shared group name and selected value. */
  type Props = {
    /** Required visible text associated with this choice. */
    label: string;
    /** Required native group name; reuse within a group and keep distinct from other groups. */
    name: string;
    /** Required stable value, unique within this group. */
    value: string;
    /** Caller-owned group selection; bind across choices, empty by default. */
    selected?: string;
    /** Whether this choice is unavailable; false by default. */
    disabled?: boolean;
    /** Optional callback receiving the selected value after the binding updates. */
    onchange?: (value: string) => void;
    /** Optional layout classes on the clickable label; empty by default. */
    class?: string;
  };
  let {
    label,
    name,
    value,
    selected = $bindable(''),
    disabled = false,
    onchange,
    class: className = ''
  }: Props = $props();
</script>

<!-- @component Native labeled radio choice with caller-owned group selection. Shared names retain browser arrow-key behavior; the control owns no settings or persistence. -->
<label class={className} data-testid="radio-selector">
  <input
    type="radio"
    {name}
    {value}
    {disabled}
    checked={selected === value}
    onchange={() => {
      selected = value;
      onchange?.(value);
    }}
  />
  <span data-testid="radio-label">{label}</span>
</label>

<style>
  label {
    display: flex;
    align-items: center;
    gap: var(--selector-gap, 8px);
  }
  input {
    flex-shrink: 0;
  }
</style>
