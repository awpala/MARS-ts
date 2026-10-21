import { tick } from 'svelte';
import { Settings } from '#lib/engine/Settings.js';
import { helpArticles, type HelpArticle } from '#lib/help/articles.js';
import { runActions, breakpointActions, popupInputOption, type Action } from '../utils/commands.js';
import { runSpeedValue } from '../utils/runSpeed.js';
import { isSavableSource } from '../utils/savableSource.js';
import { DisplayPreferences } from './DisplayPreferences.svelte.js';
import { SourceWorkspace } from './SourceWorkspace.svelte.js';
import { SimulationState } from './SimulationState.svelte.js';
import { DesktopPersistence } from './DesktopPersistence.svelte.js';
import { SourceSearch } from './SourceSearch.svelte.js';

/** Browser file-transfer capabilities supplied by mounted action components. */
export type FileTransferCommand = 'import' | 'export' | 'exportAll';

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
  readonly persistence = new DesktopPersistence(this.workspace, this.simulation, this.display);
  /** Whether browser restoration and machine initialization have finished. */
  ready = $state(false);
  /** Whether restored layout has been measured and can replace the loading overlay. */
  visible = $state(false);
  /** Currently displayed help article; null leaves Help closed. */
  help = $state.raw<HelpArticle | null>(null);
  private fileTransfers: Partial<Record<FileTransferCommand, () => void>> = {};

  /** Register a mounted file-transfer behavior and return teardown that removes only that registration. */
  registerFileTransfer(command: FileTransferCommand, action: () => void): () => void {
    this.fileTransfers[command] = action;
    return () => {
      if (this.fileTransfers[command] === action) delete this.fileTransfers[command];
    };
  }
  /** Whether a desktop dialog currently owns interaction. */
  get hasModal(): boolean {
    return !!(this.workspace.modal || this.help || this.simulation.inputRequest?.prompt);
  }
  /** Shared preference controls consumed by menu and toolbar adapters. */
  displayToggles = $derived([
    {
      icon: 'labels' as const,
      label: 'Show Labels Window',
      active: this.display.showLabels,
      toggle: () => (this.display.showLabels = !this.display.showLabels),
      disabled: false
    },
    {
      icon: 'addresses' as const,
      label: 'Addresses displayed in hexadecimal',
      active: this.display.hexAddresses,
      toggle: () => (this.display.hexAddresses = !this.display.hexAddresses),
      disabled: false
    },
    {
      icon: 'values' as const,
      label: 'Values displayed in hexadecimal',
      active: this.display.hexValues,
      toggle: () => (this.display.hexValues = !this.display.hexValues),
      disabled: false
    },
    {
      icon: 'ascii' as const,
      label: 'Display Data Segment values as ASCII',
      active: this.display.ascii,
      toggle: () => (this.display.ascii = !this.display.ascii),
      disabled: false
    },
    {
      icon: 'input' as const,
      label: popupInputOption.label,
      active: this.simulation.engineSettings[Settings.POPUP_SYSCALL_INPUT] ?? false,
      toggle: () =>
        this.simulation.updateEngineSetting(
          Settings.POPUP_SYSCALL_INPUT,
          !this.simulation.engineSettings[Settings.POPUP_SYSCALL_INPUT]
        ),
      disabled: this.simulation.running
    }
  ]);

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
      return this.simulation.breakpoints.length > 0 && !this.simulation.running;
    if (helpArticles.some((article) => article.id === action.command)) return true;
    if (this.simulation.running && action.command !== 'copy') return false;
    if (['new', 'open', 'import', 'autoSave', 'exit'].includes(action.command)) return true;
    if (action.command === 'exportAll')
      return this.workspace.tabs.length > 0 || this.workspace.libraryFiles.length > 0;
    if (!this.workspace.current) return false;
    if (['save', 'saveAs'].includes(action.command)) return isSavableSource(this.workspace.current);
    if (action.command === 'undo') return this.workspace.current.undo.length > 0;
    if (action.command === 'redo') return this.workspace.current.redo.length > 0;
    return true;
  };
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
    this.closeMenus(!!article);
    if (article) {
      this.help = article;
      return;
    }
    const transfer = this.fileTransfers[command as FileTransferCommand];
    if (transfer) {
      transfer();
      return;
    }
    if ([...runActions, ...breakpointActions].some((entry) => entry.command === command)) {
      await this.simulation.runCommand(command);
      return;
    }
    if (command === 'find') this.search.findStatus = '';
    await this.workspace.execute(command);
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
