<script lang="ts">
	import Slider from '../controls/Slider.svelte';
	import { runSpeedLabel } from '../../utils/runSpeed.js';
	/** Legacy run-speed selection; the parent applies and persists the value. */
	type Props = {
		/** Required parent-owned slider position (0–40), bindable. Positions 36–40 select unlimited execution. */
		value: number;
	};
	let { value = $bindable() }: Props = $props();
</script>

<!-- @component MARS run-speed specialization of Slider; shares execution's conversion while the desktop owns application and persistence. -->
<Slider
	class="speed ml-auto min-w-42.5 text-center text-[11px]"
	label="Run speed"
	valueText={runSpeedLabel(value)}
	min={0}
	max={40}
	step={1}
	bind:value
/>
