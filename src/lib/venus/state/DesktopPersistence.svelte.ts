import { untrack } from 'svelte';
import { loadDesktopSession, type DesktopSession } from '#lib/browser/session/DesktopSession.js';
import { DesktopSessionWriter } from '#lib/browser/session/DesktopSessionWriter.js';
import { errorMessage } from '#lib/browser/errorMessage.js';
import type { DisplayPreferences } from './DisplayPreferences.svelte.js';
import type { SourceWorkspace } from './SourceWorkspace.svelte.js';
import type { SimulationState } from './SimulationState.svelte.js';

/** Help browser state recovered with the session; the desktop owns it and the dialog it controls. */
export type HelpRecovery = {
  /** Whether the tabbed Help browser is open; setting true opens it, and false closes only the browser. */
  helpBrowserOpen: boolean;
  /** Selected top-level Help browser tab ID. */
  helpTab: string;
  /** Selected nested article ID per top-level Help browser tab ID. */
  helpTabArticles: Record<string, string>;
};

/** Per-desktop recovery boundary; effects belong to the creating component and recovery writes begin only after restoration. */
export class DesktopPersistence {
  /** Visible recovery failure; in-memory work and prior successful storage remain usable. */
  error = $state('');
  private ready = $state(false);
  private stable = $state.raw<
    Pick<DesktopSession, 'execution' | 'messages' | 'runIO' | 'unloadedError'>
  >({ execution: null, messages: '', runIO: '', unloadedError: false });
  private revision = -1;
  private readonly snapshot: () => DesktopSession;
  private readonly writer = new DesktopSessionWriter((error) => {
    this.error =
      error === undefined
        ? ''
        : `Session recovery could not be saved: ${errorMessage(error)}. Keep this tab open or export your sources.`;
  });
  /** Connect existing state owners without introducing another machine, buffer library, or execution loop. */
  constructor(
    private readonly workspace: SourceWorkspace,
    private readonly simulation: SimulationState,
    private readonly display: DisplayPreferences,
    private readonly help: HelpRecovery
  ) {
    const editHistory = $derived.by(() => {
      void workspace.tabs;
      return workspace.editor.captureHistory();
    });
    const savedExecution = $derived(
      this.stable.execution
        ? { ...this.stable.execution, labelSelection: simulation.labelSelection }
        : null
    );
    $effect(() => {
      if (this.ready) this.captureStable();
    });
    this.snapshot = () => ({
      programArguments: simulation.programArguments,
      view: display.view,
      registerTab: display.registerTab,
      messageTab: simulation.messageTab,
      help: {
        open: help.helpBrowserOpen,
        tab: help.helpTab,
        articles: { ...help.helpTabArticles }
      },
      source: workspace.current?.name ?? null,
      editHistory,
      dataView: { segment: display.dataSegment, pageOffset: display.dataPageOffset | 0 },
      selection: [workspace.selectionStart, workspace.selectionEnd],
      scroll: [Math.round(workspace.sourceScrollTop), Math.round(workspace.sourceScrollLeft)],
      breakpoints: [...simulation.breakpoints],
      breakpointsEnabled: simulation.breakpointsEnabled,
      ...this.stable,
      execution: savedExecution
    });
    $effect(() => {
      if (this.ready) this.writer.schedule(this.snapshot());
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
  /** Capture idle hardware and paired consoles synchronously, also covering exit before pending effects have run. */
  private captureStable(): void {
    const execution = this.simulation.execution;
    const messages = this.simulation.messages;
    const runIO = this.simulation.runIO;
    if (execution?.status === 'running' || this.simulation.controller?.isBusy()) return;
    let checkpoint = untrack(() => this.stable.execution);
    if (execution && execution.revision !== this.revision) {
      const machine = this.simulation.controller?.captureCheckpoint();
      if (machine) checkpoint = { machine, sources: { ...this.simulation.checkpointSources } };
      else if (!execution.statements.length) checkpoint = null;
      this.revision = execution.revision;
    }
    this.stable = {
      execution: checkpoint,
      messages,
      runIO,
      unloadedError: execution?.status === 'error' && checkpoint === null
    };
  }
  /** Capture current recovery state and write it now, as page exit does, so storage is current before it is read as a whole. Before restoration, after teardown, or while suspended it writes nothing new. */
  flush = (): void => {
    if (this.ready) {
      this.captureStable();
      this.writer.schedule(this.snapshot());
    }
    this.writer.flush();
  };
  /** Stop recovery writes, dropping any queued snapshot, while another owner replaces the stored record; page exit then leaves that record intact. The returned resume re-enables writing and queues the current state. */
  suspend(): () => void {
    this.writer.suspend();
    return () => {
      this.writer.resume();
      if (this.ready) {
        this.captureStable();
        this.writer.schedule(this.snapshot());
      }
    };
  }
  /** Capture and flush current recovery state on page exit. Teardown removes listeners and disposes the writer, flushing its latest submitted snapshot without recapturing historical reactive values during component destruction. */
  mount(): () => void {
    const flush = this.flush;
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      // Svelte teardown can expose historical reactive values; preserve the latest submitted snapshot.
      this.ready = false;
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', hidden);
      this.writer.dispose();
    };
  }
  /** Restore after source recovery and machine creation, before enabling any persistence effects. */
  restore(): void {
    const saved = loadDesktopSession();
    if (saved) {
      this.simulation.programArguments = saved.programArguments ?? '';
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
        this.simulation.messages += `Session execution could not be restored: ${errorMessage(error)}\n`;
      }
      this.workspace.editor.restoreHistory(saved.editHistory);
      this.workspace.refresh();
      this.display.dataSegment = saved.dataView.segment;
      this.display.dataPageOffset = saved.dataView.pageOffset;
      this.display.view = saved.view;
      this.display.registerTab = saved.registerTab;
      this.simulation.messageTab = saved.messageTab;
      if (saved.help) {
        this.help.helpTab = saved.help.tab;
        this.help.helpTabArticles = saved.help.articles;
        this.help.helpBrowserOpen = saved.help.open;
      }
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
