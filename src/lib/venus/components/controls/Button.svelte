<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Attachment } from 'svelte/attachments';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { describedBy } from '../../utils/dom/describedBy.js';
  import Tooltip from '../feedback/Tooltip.svelte';

  /** Native button attributes and events pass through; callers own state, layout styling, and activation. */
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
    /** Base look: plain leaves all styling to the caller, bordered adds the themed border and surface, and outlined adds only the themed border. Plain by default. */
    variant?: 'plain' | 'bordered' | 'outlined';
  };
  let {
    children: content,
    type = 'button',
    tooltip,
    keepTooltipOnClick = false,
    shortcut,
    attachment,
    variant = 'plain',
    class: className,
    ...attributes
  }: Props = $props();
  const variants = {
    plain: undefined,
    bordered: 'border border-(--theme-border,#929eaa) bg-(--theme-surface,#f8f8f8)',
    outlined: 'border border-(--theme-border,#aaa)'
  } as const;
</script>

<!-- @component Native action button with caller-supplied layout styling, an optional bordered or outlined base look, and an optional themed tooltip. Enabled actions share theme-aware hover feedback; selected/pressed controls retain their solid fill, and switches own their state-specific hover colors. Adds no layout wrapper and preserves native attributes, events, and form semantics. -->
<Tooltip text={tooltip} {shortcut} keepOpenOnClick={keepTooltipOnClick}>
  {#snippet children(trigger, description)}
    <button
      {...attributes}
      class={[variants[variant], className]}
      {type}
      {@attach trigger}
      {@attach attachment}
      aria-describedby={describedBy(attributes['aria-describedby'], description)}
    >
      {@render content?.()}
    </button>
  {/snippet}
</Tooltip>

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
