<script lang="ts">
	import Toggle from '../controls/Toggle.svelte';
	/** Registers-sidebar visibility; the desktop owns persistence and retained pane dimensions. */
	type Props = {
		/** Required parent-owned visibility, bindable; the desktop defaults to shown. */
		visible: boolean;
	};
	let { visible = $bindable() }: Props = $props();
</script>

<!-- @component Registers-specific active/inactive switch. Delegates keyboard and track behavior to Toggle while the desktop owns visibility, width, and persistence. -->
<Toggle
	class="registers-control"
	label="Registers:"
	aria-label="Registers"
	variant="active"
	bind:checked={visible}
	tooltip={visible ? 'Hide registers pane' : 'Show registers pane'}
/>
