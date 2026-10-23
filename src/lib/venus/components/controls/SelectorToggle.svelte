<script lang="ts">
  import type { Attachment } from 'svelte/attachments';
  import { describedBy } from '../../utils/dom/describedBy.js';
  import Tooltip from '../feedback/Tooltip.svelte';

  /** Native checkbox and text contract; callers own selection and workflow state. */
  type Props = {
    /** Required visible text associated with the checkbox. */
    label: string;
    /** Bindable selection, false by default; controlled callers can use onchange instead. */
    checked?: boolean;
    /** Whether selection is unavailable; defaults to false. */
    disabled?: boolean;
    /** Optional callback receiving the new selection after the binding is updated. */
    onchange?: (checked: boolean) => void;
    /** Optional accessible name overriding the visible label, for abbreviated captions. */
    'aria-label'?: string;
    /** Optional caller-owned description element ID, combined with any tooltip description. */
    'aria-describedby'?: string;
    /** Optional attachment on the label; its cleanup follows the label lifetime. */
    attachment?: Attachment<HTMLElement>;
    /** Optional themed description shown on label hover or checkbox focus; omitted or empty text adds no tooltip. */
    tooltip?: string;
    /** Optional layout classes on the label; empty by default. */
    class?: string;
  };
  let {
    label,
    checked = $bindable(false),
    disabled = false,
    onchange,
    'aria-label': ariaLabel,
    'aria-describedby': description,
    attachment,
    tooltip,
    class: className = ''
  }: Props = $props();
</script>

<!-- @component Reusable native selection box with clickable text and an optional themed tooltip. Supports caller bindings or change callbacks without desktop context; --selector-gap controls spacing. -->
<Tooltip text={tooltip} keepOpenOnClick>
  {#snippet children(trigger, tooltipDescription)}
    <label {@attach trigger} {@attach attachment} class={className}>
      <input
        type="checkbox"
        {checked}
        {disabled}
        aria-label={ariaLabel}
        aria-describedby={describedBy(description, tooltipDescription)}
        onchange={(event) => {
          checked = event.currentTarget.checked;
          onchange?.(checked);
        }}
      />
      <span>{label}</span>
    </label>
  {/snippet}
</Tooltip>

<style>
  label {
    display: inline-flex;
    align-items: center;
    gap: var(--selector-gap, 0.25em);
  }
  input {
    flex-shrink: 0;
  }
</style>
