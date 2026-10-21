import { untrack } from 'svelte';
import {
	loadDesktopSession,
	saveDesktopSession,
	type DesktopSession
} from '#lib/browser/DesktopSession.js';
import type { DisplayPreferences } from './DisplayPreferences.svelte.js';
import type { SourceWorkspace } from './SourceWorkspace.svelte.js';
import type { SimulationState } from './SimulationState.svelte.js';

/** Per-desktop recovery boundary; effects are owned by the creating component and storage starts only after restoration. */
export class DesktopPersistence {
	/** Visible recovery failure; in-memory work and prior successful storage remain usable. */
	error = $state('');
	private ready = $state(false);
	private stable = $state.raw<
		Pick<DesktopSession, 'execution' | 'messages' | 'runIO' | 'unloadedError'>
	>({ execution: null, messages: '', runIO: '', unloadedError: false });
	private revision = -1;
	/** Connect existing state owners without introducing another machine, buffer library, or execution loop. */
	constructor(
		private readonly workspace: SourceWorkspace,
		private readonly simulation: SimulationState,
		private readonly display: DisplayPreferences
	) {
		$effect(() => {
			if (!this.ready) return;
			const execution = simulation.execution;
			const messages = simulation.messages;
			const runIO = simulation.runIO;
			// Hardware and its console buffers advance together only after the execution operation settles.
			if (execution?.status === 'running' || simulation.controller?.isBusy()) return;
			let checkpoint = untrack(() => this.stable.execution);
			if (execution && execution.revision !== this.revision) {
				const machine = simulation.controller?.captureCheckpoint();
				if (machine) checkpoint = { machine, sources: { ...simulation.checkpointSources } };
				else if (!execution.statements.length) checkpoint = null;
				this.revision = execution.revision;
			}
			this.stable = {
				execution: checkpoint,
				messages,
				runIO,
				unloadedError: execution?.status === 'error' && checkpoint === null
			};
		});
		$effect(() => {
			if (!this.ready) return;
			void workspace.tabs;
			const stable = this.stable;
			try {
				saveDesktopSession({
					view: display.view === 'Execute' ? 'Execute' : 'Edit',
					registerTab: display.registerTab as 'Registers' | 'Coproc 1' | 'Coproc 0',
					messageTab: simulation.messageTab as 'Mars Messages' | 'Run I/O',
					source: workspace.current?.name ?? null,
					editHistory: workspace.editor.captureHistory(),
					dataView: { segment: display.dataSegment, pageOffset: display.dataPageOffset | 0 },
					selection: [workspace.selectionStart, workspace.selectionEnd],
					scroll: [Math.round(workspace.sourceScrollTop), Math.round(workspace.sourceScrollLeft)],
					breakpoints: [...simulation.breakpoints],
					breakpointsEnabled: simulation.breakpointsEnabled,
					...stable
				});
				this.error = '';
			} catch (error) {
				this.error = `Session recovery could not be saved: ${error instanceof Error ? error.message : String(error)}. Keep this tab open or export your sources.`;
			}
		});
		$effect(() => {
			const input = workspace.sourceInput;
			if (!this.ready || !input) return;
			// Apply restored selection only when the textarea mounts, not after every selection event.
			untrack(() => {
				input.setSelectionRange(workspace.selectionStart, workspace.selectionEnd);
				input.scrollTop = workspace.sourceScrollTop;
				input.scrollLeft = workspace.sourceScrollLeft;
			});
		});
	}
	/** Restore after source recovery and machine creation, before enabling any persistence effects. */
	restore(): void {
		const saved = loadDesktopSession();
		if (saved) {
			this.simulation.messages = saved.messages;
			this.simulation.runIO = saved.runIO;
			this.stable = {
				messages: saved.messages,
				runIO: saved.runIO,
				execution: saved.execution,
				unloadedError: saved.unloadedError
			};
			try {
				if (saved.execution) {
					this.simulation.restoreExecution(saved.execution);
				} else if (saved.unloadedError) this.simulation.controller?.restoreUnloadedError();
			} catch (error) {
				this.simulation.controller?.invalidate();
				this.simulation.messages += `Session execution could not be restored: ${error instanceof Error ? error.message : String(error)}\n`;
			}
			this.workspace.editor.restoreHistory(saved.editHistory);
			this.workspace.refresh();
			this.display.dataSegment = saved.dataView.segment;
			this.display.dataPageOffset = saved.dataView.pageOffset;
			this.display.view = saved.view;
			this.display.registerTab = saved.registerTab;
			this.simulation.messageTab = saved.messageTab;
			this.simulation.breakpoints = saved.breakpoints;
			this.simulation.breakpointsEnabled = saved.breakpointsEnabled;
			if (saved.source === this.workspace.current?.name) {
				const length = this.workspace.current?.text.length ?? 0;
				this.workspace.selectionStart = Math.min(length, saved.selection[0]);
				this.workspace.selectionEnd = Math.min(length, saved.selection[1]);
				[this.workspace.sourceScrollTop, this.workspace.sourceScrollLeft] = saved.scroll;
			}
		}
		this.ready = true;
	}
}
