<script lang="ts">
  import { clamp } from '../../utils/geometry/clamp.js';
  /** Adjustable pane boundary; all dimensions are pixels and remain owned by the caller. */
  type Props = {
    /** Required accessible description of the dimension being adjusted. */
    label: string;
    /** Required ID of the controlled pane. */
    controls: string;
    /** Required separator orientation. */
    orientation: 'horizontal' | 'vertical';
    /** Required current rendered size. */
    value: number;
    /** Required minimum allowed size. */
    min: number;
    /** Required maximum allowed size, at least min. */
    max: number;
    /** Whether increasing pointer coordinates shrink the pane; defaults to false. */
    reverse?: boolean;
    /** Optional CSS hook retained by the layout; empty by default. */
    class?: string;
    /** Required callback receiving a clamped size during dragging or keyboard adjustment. */
    onchange: (value: number) => void;
    /** Required callback to persist size at the end of a gesture or keyboard adjustment. */
    oncommit: () => void;
  };
  let {
    label,
    controls,
    orientation,
    value,
    min,
    max,
    reverse = false,
    class: className = '',
    onchange,
    oncommit
  }: Props = $props();
  let drag: { pointer: number; coordinate: number; value: number } | undefined;
  const coordinate = (event: PointerEvent) =>
    orientation === 'horizontal' ? event.clientY : event.clientX;
  function update(next: number) {
    onchange(clamp(next, min, max));
  }
  function begin(event: PointerEvent) {
    if (event.button !== 0) return;
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    handle.focus();
    drag = { pointer: event.pointerId, coordinate: coordinate(event), value };
    event.preventDefault();
  }
  function move(event: PointerEvent) {
    if (drag?.pointer === event.pointerId)
      update(drag.value + (coordinate(event) - drag.coordinate) * (reverse ? -1 : 1));
  }
  function end(event: PointerEvent) {
    if (drag?.pointer === event.pointerId) {
      drag = undefined;
      oncommit();
    }
  }
  function keydown(event: KeyboardEvent) {
    const decrease = orientation === 'horizontal' ? 'ArrowUp' : 'ArrowLeft';
    const increase = orientation === 'horizontal' ? 'ArrowDown' : 'ArrowRight';
    const sizes: Record<string, number> = {
      [decrease]: value - (reverse ? -10 : 10),
      [increase]: value + (reverse ? -10 : 10),
      Home: min,
      End: max
    };
    if (event.key in sizes) {
      event.preventDefault();
      update(sizes[event.key]);
      oncommit();
    }
  }
</script>

<!-- @component Pointer- and keyboard-adjustable separator. Pointer capture belongs to the mounted handle; no document listeners are installed. -->
<!-- WAI-ARIA focusable separators are adjustable widgets with keyboard interaction. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class={['divider', className]}
  role="separator"
  aria-label={label}
  aria-controls={controls}
  aria-orientation={orientation}
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuenow={value}
  tabindex="0"
  onpointerdown={begin}
  onpointermove={move}
  onpointerup={end}
  onpointercancel={end}
  onlostpointercapture={end}
  onkeydown={keydown}
></div>

<style>
  .divider {
    flex: 0 0 5px;
    touch-action: none;
    background: var(--theme-divider, #d4d9de);
  }
  [aria-orientation='horizontal'] {
    height: 5px;
    cursor: row-resize;
    border-block: 1px solid var(--theme-border, #a8b0b8);
  }
  [aria-orientation='vertical'] {
    width: 5px;
    cursor: col-resize;
    border-inline: 1px solid var(--theme-border, #a8b0b8);
  }
  .divider:hover,
  .divider:focus-visible {
    background: var(--theme-selected-hover, #8db3d1);
    outline: 1px solid var(--theme-focus, #2c679c);
  }
</style>
