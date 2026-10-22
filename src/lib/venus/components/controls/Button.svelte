<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Attachment } from 'svelte/attachments';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Tooltip from '../feedback/Tooltip.svelte';

  /** Native button attributes and events pass through; callers own state, base styling, and activation. */
  type Props = HTMLButtonAttributes & {
    /** Optional visible content; icon-only callers must supply an accessible name. */
    children?: Snippet;
    /** Native button behavior, defaulting to button; forms must explicitly request submit or reset. */
    type?: 'button' | 'submit' | 'reset';
    /** Optional caller-owned button attachment, cleaned up with the native element. */
    attachment?: Attachment<HTMLButtonElement>;
    /** Optional themed description; omitted or empty text leaves the button without a tooltip. */
    tooltip?: string;
    /** Keep a toggle's tooltip visible through pointer clicks while hovered; false for ordinary actions and navigation. */
    keepTooltipOnClick?: boolean;
    /** Optional keyboard hint for the tooltip; does not register a shortcut. */
    shortcut?: string;
  };
  let {
    children,
    type = 'button',
    tooltip,
    keepTooltipOnClick = false,
    shortcut,
    attachment,
    ...attributes
  }: Props = $props();
</script>

<!-- @component Native action button with caller-supplied base styling and optional themed tooltip. Enabled actions share theme-aware hover feedback; selected/pressed controls retain their solid fill, and switches own their state-specific hover colors. Adds no layout wrapper and preserves native attributes, events, and form semantics. -->
{#snippet control(trigger?: Attachment<HTMLElement>, description?: string)}
  <button
    {...attributes}
    {type}
    {@attach trigger}
    {@attach attachment}
    aria-describedby={[attributes['aria-describedby'], description].filter(Boolean).join(' ') ||
      undefined}
  >
    {@render children?.()}
  </button>
{/snippet}

{#if tooltip}
  <Tooltip text={tooltip} {shortcut} keepOpenOnClick={keepTooltipOnClick}>
    {#snippet children(trigger, description)}
      {@render control(trigger, description)}
    {/snippet}
  </Tooltip>
{:else}
  {@render control()}
{/if}

<style>
  button:enabled:hover:not(
      [aria-disabled='true'],
      [aria-pressed='true'],
      [aria-selected='true'],
      [role='switch']
    ) {
    border-color: var(--theme-accent-border, #849eb5);
    background: var(--theme-hover, #dbe8f2);
  }
</style>
