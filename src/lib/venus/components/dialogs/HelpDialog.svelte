<script lang="ts">
	import Button from '../controls/Button.svelte';
	import { getDesktop } from '../../context/desktop.js';
	import Modal from './Modal.svelte';
	import DialogActions from './DialogActions.svelte';
	import HelpArticle from '#lib/help/HelpArticle.svelte';
	const desktop = getDesktop();
	const { simulation } = desktop;
</script>

<!-- @component Selected Help content and source-transfer controls; desktop context owns article selection. -->
{#if desktop.help}
	<Modal
		title={desktop.help.title}
		onclose={desktop.closeHelp}
		initialFocus=".help-article"
		--modal-width={desktop.help.html ? 'min(900px, 94vw)' : 'min(560px, 90vw)'}
	>
		<HelpArticle
			article={desktop.help}
			canOpen={!simulation.running}
			onopen={(source) => void desktop.openHelpSource(source)}
		/>
		<DialogActions><Button onclick={desktop.closeHelp}>Close</Button></DialogActions>
	</Modal>
{/if}
