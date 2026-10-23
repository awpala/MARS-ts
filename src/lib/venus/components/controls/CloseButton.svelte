<script lang="ts">
  import IconButton from './IconButton.svelte';

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

<!-- @component Compact close button: an IconButton with the Close mark. Owns no close confirmation, visibility state, or keyboard shortcut. -->
<IconButton
  class="self-center"
  size="sm"
  icon={{ mask: 'Close' }}
  {label}
  {shortcut}
  {disabled}
  {onclick}
/>
