<script lang="ts">
  import './layout.css';
  import { asset } from '$app/paths';
  import type { Snippet } from 'svelte';
  /** Root layout contract; the router owns its child content. */
  type Props = {
    /** Required route content, rendered once with no additional state ownership. */
    children: Snippet;
  };
  let { children }: Props = $props();
</script>

<!-- @component Root static application layout, preserving the original MARS favicon and linking the web app manifest. -->
<svelte:head>
  <link rel="icon" href={asset('favicon.ico')} />
  <link rel="manifest" href={asset('manifest.webmanifest')} />
  <link rel="describedby" href={asset('llms.txt')} type="text/plain" />
</svelte:head>
{@render children()}
