<script lang="ts">
	import { runSpeedLabel } from '../../utils/runSpeed.js';
	/** Legacy run-speed selection; the parent applies and persists the value. */
	type Props = {
		/** Required parent-owned slider position (0–40), bindable. Positions 36–40 select unlimited execution. */
		value: number;
	};
	let { value = $bindable() }: Props = $props();
</script>

<!-- @component Run-speed slider and label sharing the same conversion as machine execution. -->
<label class="speed"
	>Run speed {runSpeedLabel(value)}<input
		type="range"
		min="0"
		max="40"
		step="1"
		bind:value
		aria-label="Run speed"
	/></label
>

<style>
	.speed {
		margin-left: auto;
		min-width: 170px;
		text-align: center;
		font-size: 11px;
	}
	.speed input {
		display: block;
		width: 100%;
		height: 14px;
	}
</style>
