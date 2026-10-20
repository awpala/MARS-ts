<script lang="ts">
	import { onDestroy } from 'svelte';
	import { asset } from '$app/paths';
	import Button from '../controls/Button.svelte';

	/** Exact-text transfer control; file creation remains with the caller. */
	type Props = {
		/** Required source text, copied or transferred without normalization. */
		source: string;
		/** Optional accessible label, defaulting to the variant's action. */
		label?: string;
		/** Whether the owner disallows this action; false by default. */
		disabled?: boolean;
	} & (
		| {
				/** Copy source to the system clipboard, with inline success/failure feedback. */
				variant: 'copy-code';
				/** File callbacks are not used by the copy variant. */
				ontransfer?: never;
		  }
		| {
				/** Pass source to the caller's file workflow without accessing the clipboard. */
				variant: 'transfer-to-file';
				/** Required file-owner callback; the component owns no editor or persistence state. */
				ontransfer: (source: string) => void | Promise<void>;
		  }
	);
	let { source, label, disabled = false, variant, ontransfer }: Props = $props();
	const actionLabel = $derived(variant === 'copy-code' ? 'Copy code' : 'Open as new file');
	let status = $state('');
	let busy = $state(false);
	let disposed = false;
	onDestroy(() => {
		disposed = true;
	});

	async function activate() {
		if (disabled || busy) return;
		busy = true;
		status = '';
		try {
			if (variant === 'copy-code') {
				await navigator.clipboard.writeText(source);
				if (!disposed) status = 'Copied';
			} else {
				await ontransfer?.(source);
			}
		} catch {
			if (!disposed)
				status =
					variant === 'copy-code'
						? 'Copy failed. Select the code and copy it manually.'
						: 'Unable to open code as a new file.';
		} finally {
			if (!disposed) busy = false;
		}
	}
</script>

<!-- @component Copies exact code or delegates transfer to a file owner. Owns feedback and ignores asynchronous completion after unmount. -->
<span class={['clipboard', variant]}>
	{#if variant === 'copy-code' || status}<span role="status">{status}</span>{/if}
	<Button
		class="border border-[var(--theme-border,#94a3b8)] bg-[var(--theme-surface,#f0f0f0)] p-1 hover:enabled:bg-[var(--theme-hover,#c6dcef)] disabled:opacity-50"
		tooltip={variant === 'transfer-to-file' && disabled
			? 'Stop execution to open as a new file'
			: actionLabel}
		aria-label={label ?? actionLabel}
		disabled={disabled || busy}
		onclick={activate}
	>
		{#if variant === 'copy-code'}
			<img src={asset('icons/Copy.svg')} width="18" height="18" alt="" />
		{:else}
			<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
				<path
					d="M13 3h5l4 4v14H8v-5M18 3v5h4M2 11h12m-4-4 4 4-4 4"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linejoin="round"
				/>
			</svg>
		{/if}
	</Button>
</span>

<style>
	.clipboard {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.copy-code {
		flex: 1;
	}
	[role='status'] {
		margin-right: auto;
		font-size: 12px;
	}
</style>
