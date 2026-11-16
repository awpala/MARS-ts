import { tick } from 'svelte';
import { ModalState } from './ModalState.svelte.js';
import { Settings } from '#lib/engine/Settings.js';
import {
  helpArticles,
  helpBrowserArticle,
  helpTabs,
  type HelpArticle
} from '#lib/help/articles.js';
import {
  breakpointActions,
  requireAction,
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
import { DisplayPreferences } from './DisplayPreferences.svelte.js';
import { SourceWorkspace } from './SourceWorkspace.svelte.js';
import { SimulationState } from './SimulationState.svelte.js';
import { DesktopPersistence } from './DesktopPersistence.svelte.js';
import { SourceSearch } from './SourceSearch.svelte.js';
import { MarsDataImport } from './MarsDataImport.svelte.js';

import {
  isHelpCommand,
  unhandledCommand,
  type Command,
  type FileTransferCommand
} from '../utils/commands/commands.js';

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
  /** Sole owner of dialog selection and temporary blocking overlays. */
  readonly modals = new ModalState();
  /** Display selection and geometry for this desktop. */
  readonly display = new DisplayPreferences();
  /** Source buffers, file-workflow drafts and queues, and persistence for this desktop; dialog visibility belongs to modals. */
  readonly workspace: SourceWorkspace = new SourceWorkspace(
    this.display,
    {
      invalidate: () => this.simulation.controller?.invalidate(),
      report: (error) => this.simulation.report(error),
      running: () => this.simulation.running,
      assembleOnOpen: () =>
        this.simulation.engineSettings[Settings.ASSEMBLE_ON_OPEN_ENABLED] ?? false,
      assemble: () => this.simulation.assemble()
    },
    this.modals
  );
  /** Machine host, execution presentation, pending input, and messages for this desktop. */
  readonly simulation: SimulationState = new SimulationState(
    this.workspace,
    this.display,
    this.modals
  );
  /** Search dialog state targeting this desktop's workspace. */
  readonly search = new SourceSearch(this.workspace);
  /** Browser-local recovery of the existing state graph and stable execution checkpoints. */
  readonly persistence = new DesktopPersistence(
    this.workspace,
    this.simulation,
    this.display,
    this
  );
  /** Import MARS confirmation and the replacement of this browser's stored application data. */
  readonly marsDataImport = new MarsDataImport(this.modals, {
    running: () => this.simulation.running,
    suspendRecovery: () => this.persistence.suspend(),
    beginTransfer: (status) => this.beginTransfer(status),
    restart: () => window.location.reload()
  });
  /** Whether browser restoration and machine initialization have finished. */
  ready = $state(false);
  /** Whether restored layout has been measured and can replace the loading overlay. */
  visible = $state(false);
  /** Currently displayed help article; null leaves Help closed. */
  get help(): HelpArticle | null {
    const modal = this.modals.primary;
    return modal?.kind === 'help' ? modal.article : null;
  }
  /** Help browser tab shown when Help opens; starts on the overview and is recovered with the session. */
  helpTab = $state(helpTabs[0].id);
  /** Nested Help browser article per top-level tab, retained across openings and recovered with the session. */
  helpTabArticles = $state<Record<string, string>>({});
  /** Whether the tabbed Help browser, rather than a single article or nothing, is open; recovered with the session. */
  get helpBrowserOpen(): boolean {
    return this.help === helpBrowserArticle;
  }
  set helpBrowserOpen(open: boolean) {
    if (open) this.modals.open({ kind: 'help', article: helpBrowserArticle });
    else if (this.helpBrowserOpen) this.modals.close('help');
  }
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
    return this.modals.begin({ kind: 'transfer', status });
  }
  /** Whether the modal state machine currently blocks ordinary desktop interaction. */
  get hasModal(): boolean {
    return this.modals.isOpen;
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

  /** Start in onMount. Teardown cancels initialization/reveal frames, flushes recovery, seals modal transitions, releases workspace handles, and starts simulation cleanup. */
  mount = (): (() => void) => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    let releasePersistence: (() => void) | undefined;
    let revealFrame: number | undefined;
    // Let the loading indicator paint before synchronous engine initialization.
    let initializeFrame = requestAnimationFrame(() => {
      initializeFrame = requestAnimationFrame(() => {
        this.workspace.autoSave = this.display.restore();
        this.workspace.restore();
        cleanup = this.simulation.start();
        releasePersistence = this.persistence.mount();
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
      releasePersistence?.();
      this.modals.dispose();
      this.workspace.dispose();
      cleanup?.();
    };
  };

  /** Read live command availability across the source and execution owners. */
  enabled = (action: Action): boolean => {
    // History and program ownership mutate inside the raw engine; subscribe before short-circuiting.
    void this.simulation.execution?.revision;
    if (action.unavailable) return false;
    const command = action.command;
    if (isHelpCommand(command)) return true;
    const { simulation, workspace } = this;
    switch (command) {
      case 'exceptionHandler':
        return !!simulation.machine;
      case 'memoryConfiguration':
        return !!simulation.machine && !simulation.controller?.isBusy();
      case 'clearOutput':
      case 'clearAllOutput':
        return true;
      case 'assemble':
        return !!workspace.current && !workspace.current.readOnly && !simulation.running;
      case 'pause':
      case 'stop':
        return simulation.running;
      case 'go':
      case 'step':
        return (
          simulation.execution?.status === 'assembled' || simulation.execution?.status === 'paused'
        );
      case 'backstep':
        return (
          !!simulation.machine?.program?.getBackStepper() &&
          !simulation.machine.program.getBackStepper()!.empty() &&
          !simulation.running &&
          simulation.execution?.status !== 'idle'
        );
      case 'dump':
        return (
          !!simulation.loadedFilename &&
          !simulation.controller?.isBusy() &&
          simulation.execution?.status !== 'idle'
        );
      case 'reset':
        return !!simulation.execution?.statements.length && !simulation.running;
      case 'clearBreakpoints':
      case 'toggleBreakpoints':
        return simulation.breakpoints.length > 0 && !this.breakpointsFrozen;
      case 'import':
      case 'importMars':
      case 'exportMars':
        return !simulation.running;
      case 'export':
        return !simulation.running && !!workspace.current;
      case 'exportAll':
        return (
          !simulation.running &&
          (workspace.tabs.some((tab) => !tab.readOnly) || workspace.libraryFiles.length > 0)
        );
      case 'new':
      case 'open':
      case 'autoSave':
      case 'close':
      case 'closeAll':
      case 'save':
      case 'saveAs':
      case 'saveAll':
      case 'undo':
      case 'redo':
      case 'cut':
      case 'copy':
      case 'paste':
      case 'selectAll':
      case 'find':
        return workspace.enabled(command);
      default:
        return unhandledCommand(command);
    }
  };
  /** Explain why an action is disabled, for its tooltip, or undefined when no explanation applies. */
  disabledReason = (action: Action): string | undefined =>
    this.breakpointsFrozen && breakpointActions.some((entry) => entry.command === action.command)
      ? frozenBreakpointsHint
      : undefined;
  /** Read toggle state for command presentation, or undefined for a momentary command. */
  isPressed = (command: Command): boolean | undefined =>
    command === 'autoSave'
      ? this.workspace.autoSave
      : command === 'toggleBreakpoints'
        ? this.simulation.breakpointsEnabled
        : undefined;

  /** Close menus and route a command to its owning domain. */
  execute = async (command: Command): Promise<void> => {
    if (!this.enabled(requireAction(command))) return;
    if (command === 'clearOutput' || command === 'clearAllOutput') {
      this.simulation.clearOutput(command === 'clearAllOutput');
      return;
    }
    const confirmClear = command === 'clearBreakpoints' && this.display.promptClearBreakpoints;
    if (command !== 'autoSave')
      this.closeMenus(
        isHelpCommand(command) ||
          command === 'memoryConfiguration' ||
          command === 'exceptionHandler' ||
          command === 'dump' ||
          confirmClear
      );
    if (isHelpCommand(command)) {
      this.modals.open({
        kind: 'help',
        article: helpArticles.find((article) => article.id === command)!
      });
      return;
    }
    switch (command) {
      case 'dump':
        this.modals.open({ kind: 'dump' });
        return;
      case 'memoryConfiguration':
        this.modals.open({ kind: 'memoryConfiguration' });
        return;
      case 'exceptionHandler':
        this.modals.open({ kind: 'exceptionHandler' });
        return;
      case 'import':
      case 'export':
      case 'exportAll':
      case 'importMars':
      case 'exportMars':
        await this.fileTransfers[command]?.();
        return;
      case 'clearBreakpoints':
        if (confirmClear) {
          this.modals.open({ kind: 'clearBreakpoints' });
          return;
        }
        await this.simulation.runCommand(command);
        return;
      case 'assemble':
      case 'go':
      case 'step':
      case 'backstep':
      case 'pause':
      case 'stop':
      case 'reset':
      case 'toggleBreakpoints':
        await this.simulation.runCommand(command);
        return;
      case 'new':
      case 'open':
      case 'autoSave':
      case 'close':
      case 'closeAll':
      case 'save':
      case 'saveAs':
      case 'saveAll':
      case 'undo':
      case 'redo':
      case 'cut':
      case 'copy':
      case 'paste':
      case 'selectAll':
      case 'find':
        if (command === 'find') this.search.findStatus = '';
        await this.workspace.execute(command);
        return;
      default:
        unhandledCommand(command);
    }
  };
  /** Clear breakpoints after confirmation, unless maximum speed locked them while the dialog was open. */
  confirmClearBreakpoints = async (): Promise<void> => {
    this.modals.close('clearBreakpoints');
    if (!this.breakpointsFrozen) await this.simulation.runCommand('clearBreakpoints');
  };
  /** Dismiss Help without resetting source-workflow queues. */
  closeHelp = (): void => {
    this.modals.close('help');
  };
  /** Transfer a displayed example through the normal new-file/edit workflow and focus its source. */
  openHelpSource = async (source: string): Promise<void> => {
    if (this.simulation.running) return;
    this.closeHelp();
    const tab = this.workspace.createSource(source);
    if (tab) await this.workspace.focusSource(tab);
  };
}
