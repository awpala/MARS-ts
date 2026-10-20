<script lang="ts">
	import { onMount } from 'svelte';
	import { sourceName } from '#lib/browser/SourceLibrary.js';
	import { getDesktop } from '../../context/desktop.js';
	const desktop = getDesktop();
	let input: HTMLInputElement;
	let disposed = false;
	let selection = 0;

	onMount(() => {
		const release = desktop.registerFileTransfer('import', () => input.click());
		return () => {
			disposed = true;
			selection++;
			release();
		};
	});

	async function readFiles(event: Event) {
		const picker = event.currentTarget as HTMLInputElement;
		const files = [...(picker.files ?? [])];
		picker.value = '';
		if (!files.length) return;
		const request = ++selection;
		desktop.workspace.fileError = '';
		desktop.workspace.importSources = [];
		try {
			const sources = await Promise.all(
				files.map(async (file) => {
					if (!/\.asm$/i.test(file.name)) throw new Error('Import accepts .asm source files.');
					return { name: sourceName(file.name), source: await file.text() };
				})
			);
			if (disposed || request !== selection) return;
			if (new Set(sources.map((file) => file.name)).size !== sources.length)
				throw new Error('The selected files contain duplicate names. Import distinct filenames.');
			desktop.workspace.acceptImport(sources);
		} catch (error) {
			if (!disposed && request === selection) desktop.workspace.importFailure(error);
		}
	}
</script>

<!-- @component Owns the browser import picker, exact file reads, and its registered desktop command. The workspace owns collision confirmation and persistence; superseded reads and completions after unmount are ignored. -->
<input
	class="hidden"
	type="file"
	multiple
	accept=".asm"
	bind:this={input}
	disabled={desktop.simulation.running}
	onchange={readFiles}
	aria-label="Import assembly files"
/>
