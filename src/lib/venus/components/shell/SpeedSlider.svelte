<script lang="ts">
  import Slider from '../controls/Slider.svelte';
  import Button from '../controls/Button.svelte';
  import MaskIcon from '../icons/MaskIcon.svelte';
  import { MAX_SPEED_POSITION } from '#lib/browser/DisplaySettings.js';
  import { runSpeedLabel, RUN_SPEED_MAX_POSITION } from '../../utils/execution/runSpeed.js';
  import { clamp } from '../../utils/geometry/clamp.js';
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
    const clamped = clamp(next, 0, RUN_SPEED_MAX_POSITION);
    value = clamped === RUN_SPEED_MAX_POSITION ? MAX_SPEED_POSITION : clamped;
  }
</script>

<!-- @component Run-speed specialization with one evenly spaced position per distinct speed and adjacent granular increment/decrement controls. The unlimited endpoint, where a program simply runs without debugger interaction, switches the fill to the theme's distinct maximum-speed color. The desktop retains legacy-compatible application and persistence. -->
<div class="ml-auto flex h-7.25 shrink-0 items-center gap-1">
  <Slider
    class="speed min-w-42.5 text-center text-[11px] leading-3.5"
    label="Run speed"
    valueText={runSpeedLabel(value)}
    min={0}
    max={RUN_SPEED_MAX_POSITION}
    step={1}
    data-unlimited={position === RUN_SPEED_MAX_POSITION || undefined}
    bind:value={() => position, setPosition}
  />
  <div class="grid h-full shrink-0 grid-rows-2 gap-px">
    {#each steps as step (step.icon)}
      <Button
        variant="bordered"
        class="grid h-full min-h-0 w-4 place-items-center rounded-xs disabled:opacity-40"
        aria-label={step.label}
        tooltip={step.label}
        disabled={step.delta > 0 ? position === RUN_SPEED_MAX_POSITION : position === 0}
        onclick={() => setPosition(position + step.delta)}
      >
        <MaskIcon name={step.icon} size={12} />
      </Button>
    {/each}
  </div>
</div>

<style>
  div :global(input[data-unlimited]) {
    accent-color: var(--theme-speed-max, #c4661f);
  }
</style>
