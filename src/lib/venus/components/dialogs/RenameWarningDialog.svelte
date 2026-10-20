<script lang="ts">
	import { getDesktop } from '../../context/desktop.js';
	import Modal from './Modal.svelte';
	import DialogActions from './DialogActions.svelte';
	const { workspace } = getDesktop();
</script>

<!-- @component Invalid rename warning. The workspace retains the latest valid filename and all source content. -->
<Modal title="Invalid filename" onclose={workspace.dismiss}>
	<p class="my-2" role="alert">{workspace.fileError}</p>
	<p class="my-2">The filename remains “{workspace.filename}”. Your source is unchanged.</p>
	<DialogActions>
		<button onclick={workspace.dismiss}>OK</button>
	</DialogActions>
</Modal>
