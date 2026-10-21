<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Attachment } from 'svelte/attachments';
  import KeyboardShortcut from './KeyboardShortcut.svelte';
  import { clamp } from '../../utils/clamp.js';
  /** Tooltip contract; the caller owns the trigger's label and behavior. */
  type Props = {
    /** Required plain-text description, displayed on hover or focus. Empty text suppresses the tooltip. */
    text: string;
    /** Optional keyboard hint displayed as keycaps after the description. */
    shortcut?: string;
    /** Keep descriptions through pointer activation for toggle controls only; false by default. All descriptions hide on trigger exit. */
    keepOpenOnClick?: boolean;
    /** Required trigger template. Attach the supplied attachment to one element and apply the description ID to its focusable control. */
    children: Snippet<[Attachment<HTMLElement>, string | undefined]>;
  };
  let { text, shortcut, keepOpenOnClick = false, children }: Props = $props();
  const id = $props.id();
  let visible = $state(false);
  let position = $state.raw<{ left: number; top: number; above: boolean }>();
  let hoverRegion: HTMLElement | undefined;
  let anchor: HTMLElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hovered = false;
  let focused = false;
  let dismissed = false;

  function cancelTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  function hide() {
    cancelTimer();
    visible = false;
    position = undefined;
  }
  function show() {
    cancelTimer();
    if (!dismissed && anchor?.isConnected && text.trim()) visible = true;
  }
  function leave() {
    cancelTimer();
    if (!hovered && !focused) hide();
  }
  function dismiss() {
    dismissed = true;
    hide();
  }
  function attachTrigger(element: HTMLElement) {
    anchor = element;
    const enter = () => {
      hovered = true;
      dismissed = false;
      cancelTimer();
      timer = setTimeout(show, 350);
    };
    const exit = () => {
      hovered = focused = false;
      dismissed = false;
      hide();
    };
    const focus = () => {
      // Mouse activation may leave the trigger focused after a popup or tab returns.
      // Only keyboard-visible focus should keep its description open after pointer exit.
      focused = element.matches(':focus-visible');
      if (focused) show();
    };
    const blur = () => {
      focused = false;
      dismissed = false;
      leave();
    };
    const activate = () => {
      focused = false;
      if (keepOpenOnClick && hovered) return;
      dismiss();
    };
    element.addEventListener('pointerenter', enter);
    element.addEventListener('pointerleave', exit);
    element.addEventListener('focusin', focus);
    element.addEventListener('focusout', blur);
    element.addEventListener('pointerdown', activate);
    return () => {
      element.removeEventListener('pointerenter', enter);
      element.removeEventListener('pointerleave', exit);
      element.removeEventListener('focusin', focus);
      element.removeEventListener('focusout', blur);
      element.removeEventListener('pointerdown', activate);
      anchor = undefined;
      hovered = focused = false;
      hide();
    };
  }
  function updatePosition(element: HTMLElement) {
    if (!anchor) return;
    const bounds = anchor.getBoundingClientRect();
    const tooltip = element.getBoundingClientRect();
    const above = bounds.bottom + tooltip.height + 8 > window.innerHeight;
    position = {
      left: clamp(
        bounds.left + (bounds.width - tooltip.width) / 2,
        8,
        window.innerWidth - tooltip.width - 8
      ),
      top: Math.max(8, above ? bounds.top - tooltip.height : bounds.bottom),
      above
    };
  }
  function place(element: HTMLElement) {
    // Re-measure when a live description changes, without recreating trigger listeners.
    void text;
    void shortcut;
    hoverRegion = element;
    updatePosition(element);
    return () => {
      if (hoverRegion === element) hoverRegion = undefined;
    };
  }
  $effect(() => {
    if (!visible) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
      }
    };
    const scroll = (event: Event) => {
      // A toggle can scroll nearby content without moving the pointer off its trigger.
      if (keepOpenOnClick && hovered && anchor?.matches(':hover')) {
        if (hoverRegion) updatePosition(hoverRegion);
        return;
      }
      if (!(event.target instanceof Node) || !hoverRegion?.contains(event.target)) dismiss();
    };
    window.addEventListener('keydown', escape);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('blur', dismiss);
    return () => {
      window.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('blur', dismiss);
    };
  });
</script>

<!-- @component Theme-aware hover/focus description with viewport clamping and Escape dismissal. Owns and releases its trigger listeners, visible-only window listeners, and timers. -->
{@render children(attachTrigger, visible ? id : undefined)}
{#if visible}
  <div
    {id}
    role="tooltip"
    class={['tooltip-region', { above: position?.above }]}
    {@attach place}
    style:left={`${position?.left ?? 0}px`}
    style:top={`${position?.top ?? 0}px`}
    style:visibility={position ? 'visible' : 'hidden'}
  >
    <div class="tooltip">
      {text}
      {#if shortcut}<KeyboardShortcut {shortcut} />{/if}
    </div>
  </div>
{/if}

<style>
  /* Standard descriptions never capture pointer hover; the trigger alone owns their lifetime. */
  .tooltip-region {
    pointer-events: none;
    position: fixed;
    z-index: 60;
    padding-top: 8px;
  }
  .tooltip-region.above {
    padding-top: 0;
    padding-bottom: 8px;
  }
  .tooltip {
    display: flex;
    align-items: center;
    gap: 8px;
    width: max-content;
    max-width: min(320px, calc(100vw - 16px));
    max-height: calc(100dvh - 24px);
    overflow: auto;
    padding: 6px 9px;
    border: 1px solid var(--theme-border, #8d969e);
    border-radius: 3px;
    background: var(--theme-tooltip, #ffffe1);
    color: var(--theme-text, #17202b);
    box-shadow: 2px 3px 8px #0003;
    font:
      12px/1.4 system-ui,
      sans-serif;
    font-weight: normal;
    text-align: left;
    white-space: normal;
    overflow-wrap: anywhere;
  }
</style>
