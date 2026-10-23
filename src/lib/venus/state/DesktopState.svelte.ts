import { tick } from 'svelte';
import { Settings } from '#lib/engine/Settings.js';
import {
  helpArticles,
  helpBrowserArticle,
  helpTabs,
  type HelpArticle
} from '#lib/help/articles.js';
import {
  runActions,
  breakpointActions,
  frozenBreakpointsHint,
  type Action
} from '../utils/commands/actions.js';
import {
  menuEngineOptions,
  toggleSpecs,
  type DisplayToggle,
  type EngineMenuToggle
} from '../utils/commands/settings.js';
import type { RunState } from '../RunController.js';
import { runSpeedValue, UNLIMITED_SPEED } from '../utils/execution/runSpeed.js';
import { isSavableSource } from '../utils/sources/savableSource.js';
import { DisplayPreferences } from './DisplayPreferences.svelte.js';
import { SourceWorkspace } from './SourceWorkspace.svelte.js';
import { SimulationState } from './SimulationState.svelte.js';
import { DesktopPersistence } from './DesktopPersistence.svelte.js';
import { SourceSearch } from './SourceSearch.svelte.js';

/** Browser file-transfer capabilities supplied by mounted action components. */
export type FileTransferCommand = 'import' | 'export' | 'exportAll';

/** Footer content that depends on the selected view and the loaded program; the caret position depends on focus and stays with the renderer. */
export type FooterState = {
  /** Annotation before the filename, such as `Loaded: `; empty when none applies. */
  filenamePrefix: string;
  /** Current-view filename or empty-state message. */
  filename: string;
  /** Execution status to show, or null to hide it. */
  status: RunState['status'] | null;
  /** Whether configured breakpoints are active. */
  breakpointsEnabled: boolean;
};

/** Per-component composition root. Coordinates domain capabilities without owning their internal workflows. */
export class DesktopState {
  /** Display selection and geometry for this desktop. */
  readonly display = new DisplayPreferences();
  /** Source buffers, file dialogs, and persistence for this desktop. */
  readonly workspace: SourceWorkspace = new SourceWorkspace(this.display, {
    invalidate: () => this.simulation.controller?.invalidate(),
    report: (error) => this.simulation.report(error),
    running: () => this.simulation.running,
    assembleOnOpen: () =>
      this.simulation.engineSettings[Settings.ASSEMBLE_ON_OPEN_ENABLED] ?? false,
    assemble: () => this.simulation.assemble()
  });
  /** Machine host, execution presentation, pending input, and messages for this desktop. */
  readonly simulation: SimulationState = new SimulationState(this.workspace, this.display);
  /** Search dialog state targeting this desktop's workspace. */
  readonly search = new SourceSearch(this.workspace);
  /** Browser-local recovery of the existing state graph and stable execution checkpoints. */
  readonly persistence = new DesktopPersistence(
    this.workspace,
    this.simulation,
    this.display,
    this
  );
  /** Whether browser restoration and machine initialization have finished. */
  ready = $state(false);
  /** Whether restored layout has been measured and can replace the loading overlay. */
  visible = $state(false);
  /** Currently displayed help article; null leaves Help closed. */
  help = $state.raw<HelpArticle | null>(null);
  /** Help browser tab shown when Help opens; starts on the overview and is recovered with the session. */
  helpTab = $state(helpTabs[0].id);
  /** Nested Help browser article per top-level tab, retained across openings and recovered with the session. */
  helpTabArticles = $state<Record<string, string>>({});
  /** Whether the tabbed Help browser, rather than a single article or nothing, is open; recovered with the session. */
  get helpBrowserOpen(): boolean {
    return this.help === helpBrowserArticle;
  }
  set helpBrowserOpen(open: boolean) {
    if (open) this.help = helpBrowserArticle;
    else if (this.helpBrowserOpen) this.help = null;
  }
  /** Whether the memory-layout settings dialog owns interaction; closed by default. */
  memoryConfigurationOpen = $state(false);
  /** Whether the Clear all breakpoints confirmation, enabled by its display preference, owns interaction; closed by default. */
  clearBreakpointsOpen = $state(false);
  /** Status text of the file transfer currently blocking interaction, such as `Exporting…`; null when none is pending. */
  transferStatus = $state<string | null>(null);
  private transferToken = 0;
  private fileTransfers: Partial<Record<FileTransferCommand, () => void | Promise<void>>> = {};

  /** Register a mounted file-transfer behavior and return teardown that removes only that registration. */
  registerFileTransfer(
    command: FileTransferCommand,
    action: () => void | Promise<void>
  ): () => void {
    this.fileTransfers[command] = action;
    return () => {
      if (this.fileTransfers[command] === action) delete this.fileTransfers[command];
    };
  }
  /** Block interaction behind a transfer status until the returned release runs; a later transfer supersedes this one, whose release then does nothing. */
  beginTransfer(status: string): () => void {
    const token = ++this.transferToken;
    this.transferStatus = status;
    return () => {
      if (this.transferToken === token) this.transferStatus = null;
    };
  }
  /** Whether a desktop dialog or pending file transfer currently owns interaction. */
  get hasModal(): boolean {
    return !!(
      this.transferStatus !== null ||
      this.workspace.modal ||
      this.help ||
      this.memoryConfigurationOpen ||
      this.clearBreakpointsOpen ||
      this.simulation.inputRequest?.prompt
    );
  }
  /** Live state of one engine setting: its value, whether execution blocks changing it, and the request to invert it. */
  private engineState(id: number) {
    return {
      active: this.simulation.engineSettings[id] ?? false,
      disabled: this.simulation.running,
      toggle: () => this.simulation.updateEngineSetting(id, !this.simulation.engineSettings[id])
    };
  }
  /** Shared preference controls consumed by menu and toolbar adapters. */
  displayToggles: readonly DisplayToggle[] = $derived(
    toggleSpecs.map(({ target, ...spec }) => {
      if ('display' in target) {
        const key = target.display;
        return {
          ...spec,
          active: this.display[key],
          disabled: false,
          toggle: () => (this.display[key] = !this.display[key])
        };
      }
      return { ...spec, ...this.engineState(target.engine) };
    })
  );
  /** Engine settings that only the Settings menu offers, with their live state. */
  engineMenuToggles: readonly EngineMenuToggle[] = $derived(
    menuEngineOptions.map(({ id, label, description }) => ({
      id,
      label,
      description,
      ...this.engineState(id)
    }))
  );
  /** Footer content for the selected view: the loaded program in Execute, the selected source in Edit. */
  footer: FooterState = $derived.by(() => {
    const { loadedFilename, execution, breakpointsEnabled } = this.simulation;
    const status = execution?.status;
    if (this.display.view === 'Execute')
      return {
        filenamePrefix: loadedFilename ? 'Loaded: ' : '',
        filename: loadedFilename ?? 'No program loaded',
        status: status ?? 'idle',
        breakpointsEnabled
      };
    const current = this.workspace.current;
    return {
      filenamePrefix: current ? 'Editing: ' : '',
      filename: current?.name ?? 'No current edits',
      status: status === 'error' ? status : null,
      breakpointsEnabled
    };
  });
  /** Whether breakpoint edits are locked because run speed is unlimited; the breakpoints already set still apply. */
  breakpointsFrozen = $derived(runSpeedValue(this.display.speed) === UNLIMITED_SPEED);
  /** Whether source tabs may be renamed or reordered: not while a program runs or a dialog owns interaction. */
  canEditTabs = $derived(!this.simulation.running && !this.hasModal);

  /** Create during Svelte component initialization; effects are released with that component. */
  constructor(private readonly closeMenus: (restoreFocus?: boolean) => void) {
    $effect(() => {
      if (this.ready) this.display.persist(this.workspace.autoSave);
    });
    $effect(() => {
      const machine = this.simulation.machine;
      if (!machine) return;
      machine.runSpeed = runSpeedValue(this.display.speed);
      machine
        .getSettings()
        .setBooleanSettingNonPersistent(Settings.DISPLAY_VALUES_IN_HEX, this.display.hexValues);
      machine
        .getSettings()
        .setBooleanSettingNonPersistent(
          Settings.DISPLAY_ADDRESSES_IN_HEX,
          this.display.hexAddresses
        );
      this.simulation.controller?.refresh();
    });
  }

  /** Start in onMount; return teardown for initialization/reveal frames and the owned session. */
  mount = (): (() => void) => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    let revealFrame: number | undefined;
    // Let the loading indicator paint before synchronous engine initialization.
    let initializeFrame = requestAnimationFrame(() => {
      initializeFrame = requestAnimationFrame(() => {
        this.workspace.autoSave = this.display.restore();
        this.workspace.restore();
        cleanup = this.simulation.start();
        this.persistence.restore();
        this.workspace.activate();
        this.ready = true;
        // Measure restored panes while hidden, then reveal after the first layout frame.
        void tick().then(() => {
          if (disposed) return;
          revealFrame = requestAnimationFrame(() => {
            revealFrame = requestAnimationFrame(() => {
              if (!disposed) this.visible = true;
            });
          });
        });
      });
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(initializeFrame);
      if (revealFrame !== undefined) cancelAnimationFrame(revealFrame);
      this.workspace.dispose();
      cleanup?.();
    };
  };

  /** Read live command availability across the source and execution owners. */
  enabled = (action: Action): boolean => {
    // History and program ownership mutate inside the raw engine; subscribe before short-circuiting.
    void this.simulation.execution?.revision;
    if (action.unavailable) return false;
    if (action.command === 'memoryConfiguration')
      return !!this.simulation.machine && !this.simulation.controller?.isBusy();
    if (['clearOutput', 'clearAllOutput'].includes(action.command)) return true;
    if (action.command === 'assemble') return !!this.workspace.current && !this.simulation.running;
    if (['pause', 'stop'].includes(action.command)) return this.simulation.running;
    if (['go', 'step'].includes(action.command))
      return (
        this.simulation.execution?.status === 'assembled' ||
        this.simulation.execution?.status === 'paused'
      );
    if (action.command === 'backstep')
      return (
        !!this.simulation.machine?.program?.getBackStepper() &&
        !this.simulation.machine.program.getBackStepper()!.empty() &&
        !this.simulation.running &&
        this.simulation.execution?.status !== 'idle'
      );
    if (action.command === 'reset')
      return !!this.simulation.execution?.statements.length && !this.simulation.running;
    if (['clearBreakpoints', 'toggleBreakpoints'].includes(action.command))
      return this.simulation.breakpoints.length > 0 && !this.breakpointsFrozen;
    if (helpArticles.some((article) => article.id === action.command)) return true;
    if (this.simulation.running && action.command !== 'copy') return false;
    if (['new', 'open', 'import', 'autoSave'].includes(action.command)) return true;
    if (action.command === 'exportAll')
      return this.workspace.tabs.length > 0 || this.workspace.libraryFiles.length > 0;
    if (!this.workspace.current) return false;
    if (['save', 'saveAs'].includes(action.command)) return isSavableSource(this.workspace.current);
    if (action.command === 'undo') return this.workspace.current.undo.length > 0;
    if (action.command === 'redo') return this.workspace.current.redo.length > 0;
    return true;
  };
  /** Explain why an action is disabled, for its tooltip, or undefined when no explanation applies. */
  disabledReason = (action: Action): string | undefined =>
    this.breakpointsFrozen && breakpointActions.some((entry) => entry.command === action.command)
      ? frozenBreakpointsHint
      : undefined;
  /** Read toggle state for command presentation, or undefined for a momentary command. */
  isPressed = (command: string): boolean | undefined =>
    command === 'autoSave'
      ? this.workspace.autoSave
      : command === 'toggleBreakpoints'
        ? this.simulation.breakpointsEnabled
        : undefined;

  /** Close menus and route a command to its owning domain. */
  execute = async (command: string): Promise<void> => {
    if (command === 'clearOutput' || command === 'clearAllOutput') {
      this.simulation.clearOutput(command === 'clearAllOutput');
      return;
    }
    const article = helpArticles.find((entry) => entry.id === command);
    const confirmClear = command === 'clearBreakpoints' && this.display.promptClearBreakpoints;
    this.closeMenus(!!article || command === 'memoryConfiguration' || confirmClear);
    if (confirmClear) {
      this.clearBreakpointsOpen = true;
      return;
    }
    if (command === 'memoryConfiguration') {
      if (this.simulation.machine && !this.simulation.controller?.isBusy())
        this.memoryConfigurationOpen = true;
      return;
    }
    if (article) {
      this.help = article;
      return;
    }
    const transfer = this.fileTransfers[command as FileTransferCommand];
    if (transfer) {
      await transfer();
      return;
    }
    if ([...runActions, ...breakpointActions].some((entry) => entry.command === command)) {
      await this.simulation.runCommand(command);
      return;
    }
    if (command === 'find') this.search.findStatus = '';
    await this.workspace.execute(command);
  };
  /** Clear breakpoints after confirmation, unless maximum speed locked them while the dialog was open. */
  confirmClearBreakpoints = async (): Promise<void> => {
    this.clearBreakpointsOpen = false;
    if (!this.breakpointsFrozen) await this.simulation.runCommand('clearBreakpoints');
  };
  /** Dismiss Help without resetting source-workflow queues. */
  closeHelp = (): void => {
    this.help = null;
  };
  /** Transfer a displayed example through the normal new-file/edit workflow and focus its source. */
  openHelpSource = async (source: string): Promise<void> => {
    if (this.simulation.running) return;
    this.closeHelp();
    const tab = this.workspace.createSource(source);
    if (tab) await this.workspace.focusSource(tab);
  };
}
