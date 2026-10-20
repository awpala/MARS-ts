<script lang="ts">
	import { downloadSource } from '#lib/browser/download.js';
	import { getDesktop } from '../../context/desktop.js';

	/** Export behavior for the corresponding desktop command; renders no additional control. */
	type Props = {
		/** Required scope: the current source, or saved sources merged with all open edits. */
		variant: 'single' | 'all';
	};
	let { variant }: Props = $props();
	const desktop = getDesktop();

	function exportFiles() {
		try {
			const sources = desktop.workspace.sourcesForExport(variant === 'all');
			// eslint-disable-next-line svelte/prefer-svelte-reactivity -- Download filenames are temporary bookkeeping, never rendered state.
			const names = new Set<string>();
			for (const file of sources) {
				const stem = file.name
					.split('/')
					.at(-1)!
					.replace(/\.[^.]+$/, '');
				let name = `${stem}.asm`;
				let suffix = 2;
				while (names.has(name)) name = `${stem}-${suffix++}.asm`;
				names.add(name);
				downloadSource(name, file.source);
			}
		} catch (error) {
			desktop.simulation.report(error);
		}
	}

	$effect(() => {
		// Re-register if a caller changes scope, and release the previous capability.
		return desktop.registerFileTransfer(variant === 'all' ? 'exportAll' : 'export', exportFiles);
	});
</script>

<!-- @component Single/all source-download behavior registered with the current desktop. Menus and toolbars share its command; teardown removes the capability. -->
