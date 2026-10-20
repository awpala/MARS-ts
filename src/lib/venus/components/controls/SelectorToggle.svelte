<script lang="ts">
	import type { Attachment } from 'svelte/attachments';

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
		/** Optional caller-owned description element ID, such as a tooltip. */
		'aria-describedby'?: string;
		/** Optional attachment on the label; its cleanup follows the label lifetime. */
		attachment?: Attachment<HTMLElement>;
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
		class: className = ''
	}: Props = $props();
</script>

<!-- @component Reusable native selection box with clickable text. Supports caller bindings or change callbacks without desktop context; --selector-gap controls spacing. -->
<label {@attach attachment} class={className}>
	<input
		type="checkbox"
		{checked}
		{disabled}
		aria-label={ariaLabel}
		aria-describedby={description}
		onchange={(event) => {
			checked = event.currentTarget.checked;
			onchange?.(checked);
		}}
	/>
	<span>{label}</span>
</label>

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
