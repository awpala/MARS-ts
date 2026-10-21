<script lang="ts">
  import Toggle from '../controls/Toggle.svelte';
  /** Register-bank sidebar visibility (Registers, Coproc 1, and Coproc 0); the desktop owns persistence and retained pane dimensions. */
  type Props = {
    /** Required parent-owned visibility, bindable; the desktop defaults to shown. */
    visible: boolean;
  };
  let { visible = $bindable() }: Props = $props();
</script>

<!-- @component Register-bank sidebar active/inactive switch, covering the Registers, Coproc 1, and Coproc 0 tabs. Delegates keyboard and track behavior to Toggle while the desktop owns visibility, width, and persistence. -->
<Toggle
  class="register-banks-control"
  label="Register Banks:"
  aria-label="Register banks"
  variant="active"
  bind:checked={visible}
  tooltip={visible ? 'Hide register banks' : 'Show register banks'}
/>
