<script lang="ts">
	import { tick } from 'svelte';
	import TabbedPane from '../layout/TabbedPane.svelte';
	import Button from '../controls/Button.svelte';
	/** Console view; host output and pending syscall input remain owned by the desktop. */
	type Props = {
		/** Required selected output tab, bindable for host-triggered selection changes. */
		messageTab: string;
		/** Required desktop-owned assembler/debugger output. */
		messages: string;
		/** Required desktop-owned program output. */
		runIO: string;
		/** Required indication that inline syscall input is pending. */
		awaitingInput: boolean;
		/** Required current input buffer owned by the host. */
		inputText: string;
		/** Required callback handling newline and syscall length limits. */
		oninput: (event: Event) => void;
		/** Required callback completing the pending input. */
		onsubmit: () => void;
		/** Required callback clearing selected output, or both outputs when all is true. */
		onclear: (all?: boolean) => void;
		/** Required callback stopping execution and releasing input. */
		onstop: () => void;
	};
	let {
		messageTab = $bindable(),
		messages,
		runIO,
		awaitingInput,
		inputText,
		oninput,
		onsubmit,
		onstop,
		onclear
	}: Props = $props();
	let outputText = $derived(messageTab === 'Mars Messages' ? messages : runIO);

	function followOutput(element: HTMLTextAreaElement) {
		$effect(() => {
			const text = outputText;
			let active = true;
			// Wait for the textarea value and console layout to reflect this output.
			void tick().then(() => {
				if (active && element.value === text) element.scrollTop = element.scrollHeight;
			});
			return () => {
				active = false;
			};
		});
	}

	function focusInput(element: HTMLTextAreaElement) {
		element.focus();
	}
</script>

<!-- @component Output and inline syscall input composed inside the reusable pane shell. -->
<TabbedPane
	class="messages"
	label="Messages and console"
	tabs={['Mars Messages', 'Run I/O']}
	bind:selected={messageTab}
	--pane-min-height="80px"
>
	{#snippet actions()}
		<Button
			class="clear mb-0.5 ml-auto rounded-none border border-[var(--theme-border,#aaa)] px-3 py-px"
			tooltip="Clear selected output"
			shortcut="Ctrl+L"
			aria-keyshortcuts="Control+L"
			onclick={() => onclear()}>Clear</Button
		>

		<Button
			tooltip="Clear all outputs"
			shortcut="Ctrl+Shift+L"
			class="clear-all mb-0.5 rounded-none border border-[var(--theme-border,#aaa)] px-3 py-px"
			aria-keyshortcuts="Control+Shift+L"
			onclick={() => onclear(true)}>Clear All</Button
		>
	{/snippet}
	<textarea {@attach followOutput} readonly aria-label={messageTab} value={outputText}></textarea>
	{#if awaitingInput && messageTab === 'Run I/O'}<form
			class="console-input"
			onsubmit={(event) => {
				event.preventDefault();
				onsubmit();
			}}
		>
			<label
				>Input <textarea
					{@attach focusInput}
					aria-label="Run input"
					rows="1"
					value={inputText}
					{oninput}></textarea></label
			><Button class="border border-[var(--theme-border,#aaa)] px-2 py-0.5" type="submit"
				>Submit</Button
			><Button class="border border-[var(--theme-border,#aaa)] px-2 py-0.5" onclick={() => onstop()}
				>Stop</Button
			>
		</form>{/if}
</TabbedPane>

<style>
	textarea {
		flex: 1;
		min-height: 0;
		background: var(--theme-canvas, white);
		padding: 6px;
		resize: none;
		font: 13px/1.4 monospace;
	}
	.console-input {
		display: flex;
		gap: 8px;
		padding: 4px 6px;
		background: var(--theme-chrome, #eee);
	}
	.console-input label {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 8px;
	}
	.console-input textarea {
		flex: 1;
		min-width: 0;
		min-height: 26px;
		border: 1px solid var(--theme-border, #aaa);
		background: var(--theme-canvas, white);
		resize: none;
	}
</style>
