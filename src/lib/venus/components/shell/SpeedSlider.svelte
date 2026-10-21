<script lang="ts">
	import { asset } from '$app/paths';
	import Slider from '../controls/Slider.svelte';
	import Button from '../controls/Button.svelte';
	import { runSpeedLabel, RUN_SPEED_MAX_POSITION } from '../../utils/runSpeed.js';
	/** Legacy-compatible run speed; the parent applies and persists the value. */
	type Props = {
		/** Required parent-owned legacy position (0–40), bindable; maximum positions 36–40 share one UI endpoint. */
		value: number;
	};
	let { value = $bindable() }: Props = $props();
	const position = $derived(Math.min(value, RUN_SPEED_MAX_POSITION));
	const steps = [
		{ icon: 'Plus', label: 'Increase run speed', delta: 1 },
		{ icon: 'Minus', label: 'Decrease run speed', delta: -1 }
	] as const;
	function setPosition(next: number) {
		const clamped = Math.max(0, Math.min(RUN_SPEED_MAX_POSITION, next));
		value = clamped === RUN_SPEED_MAX_POSITION ? 40 : clamped;
	}
</script>

<!-- @component Run-speed specialization with one evenly spaced position per distinct speed and adjacent granular increment/decrement controls. The desktop retains legacy-compatible application and persistence. -->
<div class="ml-auto flex items-center gap-1">
	<Slider
		class="speed min-w-42.5 text-center text-[11px]"
		label="Run speed"
		valueText={runSpeedLabel(value)}
		min={0}
		max={RUN_SPEED_MAX_POSITION}
		step={1}
		bind:value={() => position, setPosition}
	/>
	<div class="flex shrink-0 flex-col gap-px">
		{#each steps as step (step.icon)}
			<Button
				class="grid h-4 w-4 place-items-center rounded-xs border border-(--theme-border,#a2aab1) bg-(--theme-surface,#fafafa) hover:enabled:bg-(--theme-hover,#dbe8f2) disabled:opacity-40"
				aria-label={step.label}
				tooltip={step.label}
				disabled={step.delta > 0 ? position === RUN_SPEED_MAX_POSITION : position === 0}
				onclick={() => setPosition(position + step.delta)}
			>
				<span
					class="step-icon"
					style:mask-image={`url("${asset(`icons/${step.icon}.svg`)}")`}
					aria-hidden="true"
				></span>
			</Button>
		{/each}
	</div>
</div>

<style>
	.step-icon {
		width: 12px;
		height: 12px;
		background: currentColor;
		mask-position: center;
		mask-repeat: no-repeat;
		mask-size: contain;
	}
</style>
