<script lang="ts">
  import Button from './Button.svelte';
  import MaskIcon from '../shell/MaskIcon.svelte';

  /** Shared close affordance; callers own the document or pane visibility workflow. */
  type Props = {
    /** Required accessible name and tooltip describing what closes or hides. */
    label: string;
    /** Optional displayed shortcut hint; does not register a keyboard command. */
    shortcut?: string;
    /** Whether activation is unavailable; false by default. */
    disabled?: boolean;
    /** Required callback requesting the owner's close or hide action. */
    onclick: () => void;
  };
  let { label, shortcut, disabled = false, onclick }: Props = $props();
</script>

<!-- @component Compact close button with shared theme-aware hover styling and description. Owns no close confirmation, visibility state, or keyboard shortcut. -->
<Button
  class="grid size-4.5 shrink-0 place-items-center self-center border border-transparent hover:enabled:border-(--theme-accent-border,#849eb5) hover:enabled:bg-(--theme-hover,#dbe8f2) disabled:opacity-35"
  aria-label={label}
  tooltip={label}
  {shortcut}
  {disabled}
  {onclick}
>
  <MaskIcon name="Close" size={12} />
</Button>
