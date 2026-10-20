<script lang="ts">
	/**
	 * Presents help/*.html and the help/about responsibilities of mars/venus/HelpHelpAction.java
	 * and mars/venus/HelpAboutAction.java.
	 * Copyright 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
	 */
	import { asset } from '$app/paths';
	import type { HelpArticle } from './articles.js';

	/** Presentation contract; the desktop owns dialog state and dismissal. */
	type Props = {
		/** Required catalog entry. Only reviewed, bundled HTML may be rendered. */
		article: HelpArticle;
		/** Required desktop callback; creates an editor source from the exact displayed code text. */
		onopen: (source: string) => void;
		/** Required desktop permission; false while execution prevents creating an editor source. */
		canOpen: boolean;
	};
	let { article, onopen, canOpen }: Props = $props();

	// Attach controls to pre elements without splitting valid HTML across nested lists/paragraphs.
	function enhanceExamples(element: HTMLElement) {
		const enabled = canOpen;
		let disposed = false;
		const cleanup: (() => void)[] = [];
		for (const [index, pre] of [...element.querySelectorAll('pre')].entries()) {
			const source = pre.textContent ?? '';
			const controls = document.createElement('div');
			controls.className = 'snippet-controls';
			const status = document.createElement('span');
			status.setAttribute('role', 'status');
			const copy = document.createElement('button');
			copy.type = 'button';
			copy.title = 'Copy code';
			copy.setAttribute('aria-label', `Copy code example ${index + 1}`);
			const icon = document.createElement('img');
			icon.src = asset('icons/Copy.svg');
			icon.alt = '';
			icon.width = icon.height = 18;
			copy.append(icon);
			const open = document.createElement('button');
			open.type = 'button';
			open.title = enabled ? 'Open as new file' : 'Stop execution to open as a new file';
			open.setAttribute('aria-label', `Open code example ${index + 1} as new file`);
			open.disabled = !enabled;
			const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('viewBox', '0 0 24 24');
			svg.setAttribute('width', '18');
			svg.setAttribute('height', '18');
			svg.setAttribute('aria-hidden', 'true');
			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('d', 'M13 3h5l4 4v14H8v-5M18 3v5h4M2 11h12m-4-4 4 4-4 4');
			path.setAttribute('fill', 'none');
			path.setAttribute('stroke', 'currentColor');
			path.setAttribute('stroke-width', '1.5');
			path.setAttribute('stroke-linejoin', 'round');
			svg.append(path);
			open.append(svg);
			const copyCode = async () => {
				try {
					await navigator.clipboard.writeText(source);
					if (!disposed) status.textContent = 'Copied';
				} catch {
					if (!disposed) status.textContent = 'Copy failed. Select the code and copy it manually.';
				}
			};
			const openCode = () => onopen(source);
			copy.addEventListener('click', copyCode);
			open.addEventListener('click', openCode);
			controls.append(status, copy, open);
			pre.before(controls);
			cleanup.push(() => {
				copy.removeEventListener('click', copyCode);
				open.removeEventListener('click', openCode);
				controls.remove();
			});
		}
		return () => {
			disposed = true;
			cleanup.forEach((release) => release());
		};
	}
</script>

<!-- @component Help article presentation, including the overview and About; the app-wide Modal owns dialog behavior. Adapted articles credit MARS, copyright 2003–2013 Pete Sanderson and Kenneth Vollmar, MIT. -->
<article class="help-article" tabindex="-1" aria-label={article.title}>
	{#if article.html}
		{#key article.id}
			<div {@attach enhanceExamples}>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- Only static, repository-authored HTML imports from the Help catalog; no user or network content. -->
				{@html article.html}
			</div>
		{/key}
		<footer>
			Adapted from MARS help. Copyright © 2003–2013 Pete Sanderson and Kenneth Vollmar.
			<a href={asset('MARSlicense.txt')} target="_blank" rel="noopener noreferrer">
				MIT license (opens in a new tab)</a
			>.
		</footer>
	{:else if article.id === 'about'}
		<h3>MARS — MIPS Assembler and Runtime Simulator</h3>
		<p>MARS-ts 1.0 development</p>
		<p>
			Original MARS: copyright © 2003–2013 Pete Sanderson and Kenneth Vollmar. Distributed under the
			MIT license.
		</p>
		<p>Mars imagery credit: NASA/JPL.</p>
		<p>
			<a href={asset('MARSlicense.txt')} target="_blank" rel="noopener noreferrer">
				Read the MIT license (opens in a new tab)</a
			>
		</p>
	{:else}
		<p>
			New creates a source file; Open selects saved files in this browser. Save commits your source
			locally, and Auto Save commits edits automatically when enabled. Open tabs and in-progress
			text are recovered after reload. Import reads .asm files from your computer; Export downloads
			copies.
		</p>
		<p>
			Registers remain visible beside Edit and Execute. Use the toolbar toggles to change value
			display and label visibility.
		</p>
		<p>
			Assemble (F3) translates the current source. Go (F5), Step (F7), Backstep (F8), Pause (F9),
			Stop (F11), and Reset (F12) control execution. Select breakpoints in Text Segment. Tools and
			memory export are deferred.
		</p>
		<p>
			The Help menu also contains Introduction, Debugging, Settings, Syscalls, Exception Handlers,
			Macros, Tools, Limitations, Release History, and Acknowledgements articles.
		</p>
	{/if}
</article>

<style>
	.help-article {
		font-size: 14px;
		line-height: 1.6;
		overflow-wrap: anywhere;
	}
	.help-article:focus {
		outline: none;
	}
	.help-article :global(h3),
	.help-article :global(h4) {
		margin: 1em 0 0.5em;
		font-weight: 600;
	}
	.help-article :global(h3) {
		font-size: 1.15em;
	}
	.help-article :global(p),
	.help-article :global(ul),
	.help-article :global(ol),
	.help-article :global(pre) {
		margin: 0.75em 0;
	}
	.help-article :global(ul),
	.help-article :global(ol) {
		padding-left: 1.6em;
	}
	.help-article :global(ul) {
		list-style: disc;
	}
	.help-article :global(ol) {
		list-style: decimal;
	}
	.help-article :global(li + li) {
		margin-top: 0.5em;
	}
	.help-article :global(pre) {
		overflow-x: auto;
		padding: 12px;
		background: var(--theme-background, #e5e7eb);
		tab-size: 4;
	}
	.help-article :global(.snippet-controls) {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		margin-top: 12px;
		padding: 4px 6px;
		border: 1px solid var(--theme-border, #94a3b8);
		background: var(--theme-heading, #d9e4ef);
	}
	.help-article :global(.snippet-controls + pre) {
		margin-top: 0;
	}
	.help-article :global(.snippet-controls button) {
		padding: 4px;
		border: 1px solid var(--theme-border, #94a3b8);
		background: var(--theme-surface, #f0f0f0);
	}
	.help-article :global(.snippet-controls span) {
		font-size: 12px;
		margin-right: auto;
	}
	.help-article :global(.snippet-controls button:disabled) {
		opacity: 0.5;
	}
	.help-article :global(code),
	.help-article :global(pre) {
		font-family: monospace;
	}
	.help-article :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1em 0;
	}
	.help-article :global(th),
	.help-article :global(td) {
		border: 1px solid var(--theme-border, #94a3b8);
		padding: 6px;
		text-align: left;
		vertical-align: top;
	}
	.help-article :global(th),
	.help-article :global(.notice) {
		background: var(--theme-heading, #d9e4ef);
	}
	.help-article :global(.service-reference) {
		max-height: min(420px, 55dvh);
		overflow: auto;
		overscroll-behavior: contain;
		border: 1px solid var(--theme-border, #94a3b8);
	}
	.help-article :global(.service-reference:focus-visible) {
		outline: 2px solid var(--theme-focus, #2c679c);
	}
	.help-article :global(.service-reference table) {
		table-layout: fixed;
		min-width: 620px;
		margin: 0;
		border-collapse: separate;
		border-spacing: 0;
	}
	.help-article :global(.service-reference th) {
		position: sticky;
		top: 0;
		z-index: 1;
	}
	.help-article :global(.service-reference tbody tr:nth-child(even)) {
		background: var(--theme-row-even, #eaf0f6);
	}
	.help-article :global(.service-name) {
		width: 20%;
	}
	.help-article :global(.service-code) {
		width: 12%;
	}
	.help-article :global(.service-arguments) {
		width: 26%;
	}
	.help-article :global(.service-result) {
		width: 26%;
	}
	.help-article :global(.service-availability) {
		width: 16%;
	}
	.help-article :global(.notice) {
		padding: 12px;
	}
	.help-article :global(a) {
		color: var(--theme-accent-text, #0645ad);
		text-decoration: underline;
	}
	footer {
		border-top: 1px solid var(--theme-border, #94a3b8);
		margin-top: 24px;
		padding-top: 12px;
		font-size: 12px;
	}
</style>
