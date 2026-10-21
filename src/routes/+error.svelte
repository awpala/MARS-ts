<script lang="ts">
	import { resolve } from '$app/paths';

	/** Router-owned error details; this view owns no application or simulator state. */
	type Props = {
		/** Safe status and message supplied by SvelteKit for the failed route. */
		error: App.Error;
	};
	let { error }: Props = $props();
</script>

<!-- @component Theme-aware fallback for missing routes and route errors, with navigation back to the IDE. -->
<svelte:head>
	<title>{error.status} — MARS</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	<section aria-labelledby="error-heading">
		<p class="status">{error.status}</p>
		<h1 id="error-heading">{error.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
		<p>
			{error.status === 404
				? 'The page you requested could not be found.'
				: 'This page could not be loaded. Return to MARS to try again.'}
		</p>
		<a href={resolve('/')} data-sveltekit-reload>Back to MARS</a>
	</section>
</main>

<style>
	main {
		display: grid;
		min-height: 100dvh;
		place-items: center;
		padding: 1.5rem;
		background: var(--theme-background, #ededed);
		color: var(--theme-text, #17202b);
	}
	section {
		width: min(100%, 28rem);
		padding: 2rem;
		border: 1px solid var(--theme-border, #aaa);
		border-radius: 0.5rem;
		background: var(--theme-surface, #fff);
		text-align: center;
	}
	.status {
		margin: 0 0 0.5rem;
		color: var(--theme-muted, #596574);
		font-size: 0.875rem;
	}
	h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
	}
	p {
		margin: 1rem 0 1.5rem;
	}
	a {
		display: inline-block;
		padding: 0.625rem 1rem;
		border: 1px solid var(--theme-accent-border, #507b9f);
		border-radius: 0.25rem;
		background: var(--theme-chrome, #e8eef4);
		color: var(--theme-accent-text, #234e70);
		text-decoration: none;
	}
	a:hover {
		background: var(--theme-hover, #d6e5f2);
	}
</style>
