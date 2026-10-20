<script lang="ts">
	import Button from '../controls/Button.svelte';
	import { getDesktop } from '../../context/desktop.js';
	import Modal from './Modal.svelte';
	import DialogActions from './DialogActions.svelte';
	import DialogField from './DialogField.svelte';
	const { simulation } = getDesktop();
</script>

<!-- @component Prompted syscall input; simulation context owns completion and cancellation. -->
{#if simulation.inputRequest?.prompt}<Modal
		title="Run Input"
		onclose={() => simulation.controller?.stop()}
		><form
			onsubmit={(event) => {
				event.preventDefault();
				simulation.completeInput(true);
			}}
		>
			<p class="my-2">{simulation.inputRequest.prompt}</p>
			<DialogField label="Value"
				><input aria-label="Syscall input" bind:value={simulation.inputText} /></DialogField
			>
			<DialogActions>
				<Button type="submit">OK</Button><Button
					type="button"
					onclick={() => simulation.controller?.stop()}>Cancel</Button
				>
			</DialogActions>
		</form></Modal
	>{/if}
