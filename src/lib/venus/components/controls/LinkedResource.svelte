<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Attachment } from 'svelte/attachments';
  import type { HTMLAnchorAttributes } from 'svelte/elements';
  import Tooltip from '../feedback/Tooltip.svelte';

  /** Native anchor attributes and events pass through; the destination always opens in a new tab without an opener reference. */
  type Props = Omit<HTMLAnchorAttributes, 'href' | 'target' | 'rel' | 'children'> & {
    /** Required destination, resolved by the caller (for example through `asset` for bundled files). */
    href: string;
    /** Required visible content; icon-only callers must supply an accessible name. Callers own any "opens in a new tab" wording. */
    children: Snippet;
    /** Optional caller-owned anchor attachment, cleaned up with the native element. */
    attachment?: Attachment<HTMLAnchorElement>;
    /** Optional themed description; omitted or empty text leaves the link without a tooltip. */
    tooltip?: string;
  };
  let { href, children, tooltip, attachment, ...attributes }: Props = $props();
</script>

<!-- @component Generic link to an external or bundled resource. Opens a separate tab with `noopener noreferrer`, leaving the current desktop session in place. Adds no default visual style; native attributes and events pass through. -->
{#snippet link(trigger?: Attachment<HTMLElement>, description?: string)}
  <!-- Callers pass external URLs or asset() paths, opened in a separate tab rather than as app navigation. -->
  <!-- eslint-disable svelte/no-navigation-without-resolve -->
  <a
    {...attributes}
    {href}
    target="_blank"
    rel="noopener noreferrer"
    {@attach trigger}
    {@attach attachment}
    aria-describedby={[attributes['aria-describedby'], description].filter(Boolean).join(' ') ||
      undefined}
  >
    {@render children()}
  </a>
  <!-- eslint-enable svelte/no-navigation-without-resolve -->
{/snippet}

{#if tooltip}
  <Tooltip text={tooltip}>
    {#snippet children(trigger, description)}
      {@render link(trigger, description)}
    {/snippet}
  </Tooltip>
{:else}
  {@render link()}
{/if}
