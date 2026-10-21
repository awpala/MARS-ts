<script lang="ts">
	import type { RunState } from '../../RunController.js';
	/** Parent-resolved desktop status; this component owns presentation only. */
	type Props = {
		/** Required current-view filename or empty-state message, resolved by the caller. */
		filename: string;
		/** Optional parent-resolved filename annotation; defaults to no prefix and stays regular weight. */
		filenamePrefix?: string;
		/** Required editor caret position, or null when the source editor is not focused in Edit. */
		position: { line: number; column: number } | null;
		/** Required execution status from the controller snapshot, or null to hide the right-side annotation. */
		status: RunState['status'] | null;
		/** Required parent-owned breakpoint activation flag; false adds the suspension annotation. */
		breakpointsEnabled: boolean;
	};
	let { filename, filenamePrefix = '', position, status, breakpointsEnabled }: Props = $props();
</script>

<!-- @component Desktop footer showing the current-view filename, focused editor caret, and execution status supplied by its parent. -->
<footer>
	<span>{filenamePrefix}<strong>{filename}</strong></span>
	<span>{position ? `Line ${position.line}, Column ${position.column}` : ''}</span>
	<span>
		{#if status !== null}<span aria-label="Execution status"
				>Status: <strong>{status}</strong>{!breakpointsEnabled
					? ' — breakpoints suspended'
					: ''}</span
			>{/if}
	</span>
</footer>

<style>
	footer {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 2px 8px;
		border-top: 1px solid var(--theme-border, #aaa);
		font-size: 11px;
	}
</style>
