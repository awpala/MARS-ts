import type { SavedExecution, SavedLabelSelection } from '#lib/browser/DesktopSession.js';
import { browserEnginePreferences } from '#lib/browser/EnginePreferences.js';
import { Globals } from '#lib/engine/Globals.js';
import { ProcessingException } from '#lib/engine/diagnostics/ProcessingException.js';
import { Settings } from '#lib/engine/Settings.js';
import type { InputRequest } from '#lib/engine/io/SystemIO.js';
import { Simulator } from '#lib/engine/simulator/Simulator.js';
import { RunController } from '../RunController.js';
import { engineOptions } from '../utils/commands.js';
import { errorMessage } from '../utils/errorMessage.js';
import type { SourceWorkspace } from './SourceWorkspace.svelte.js';
import type { DisplayPreferences } from './DisplayPreferences.svelte.js';
/** Browser-owned simulation presentation, input completion, and scheduling around a framework-free RunController. */
export class SimulationState {
  /** Machine owned by this desktop; absent before browser initialization. */
  machine = $state.raw<Globals>();
  /** Framework-free execution coordinator owned by this desktop. */
  controller = $state.raw<RunController>();
  /** Latest immutable controller snapshot. */
  execution = $state.raw<ReturnType<RunController['getState']>>();
  /** Selected label owned by the loaded program, independent of the currently displayed Edit source. */
  labelSelection = $state.raw<SavedLabelSelection | null>(null);
  /** Configured instruction addresses; suspension retains this list. */
  breakpoints = $state.raw<number[]>([]);
  /** Whether Go supplies configured breakpoints to the simulator. */
  breakpointsEnabled = $state(true);
  /** Reactive values of settings exposed in desktop menus. */
  engineSettings = $state<Record<number, boolean>>({});
  /** Pending syscall request, or null when no input is owed. */
  inputRequest = $state.raw<InputRequest | null>(null);
  /** Current pending input buffer. */
  inputText = $state('');
  private resolveInput: ((text: string) => void) | undefined = undefined;
  /** Whether the current controller snapshot is running. */
  running = $derived(this.execution?.status === 'running');
  /** Selected output pane. */
  messageTab = $state('Mars Messages');
  /** Assembler and execution diagnostics. */
  messages = $state('');
  /** Console output and echoed input. */
  runIO = $state('');
  /** Exact virtual sources read for the loaded assembly, independent of later Edit selection. */
  checkpointSources: Record<string, string> = Object.create(null);
  private recoverySources: Record<string, string> | null = null;
  private disposed = false;
  /** Compose the machine host with source resolution and display navigation owned by this desktop. */
  constructor(
    private readonly workspace: SourceWorkspace,
    private readonly display: DisplayPreferences
  ) {}
  /** Clear selected output, or both outputs when all is true, preserving selection and pending input. */
  clearOutput = (all = false): void => {
    if (all || this.messageTab === 'Mars Messages') this.messages = '';
    if (all || this.messageTab === 'Run I/O') this.runIO = '';
  };
  /** Initialize browser host services and the machine; return teardown for subscriptions, pending input, and scheduler timers. */
  start(): () => void {
    let disposed = false;
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Scheduler handles are owned resources, never rendered reactive state.
    const timers = new Map<ReturnType<typeof setTimeout>, () => void>();
    const wake = () => {
      for (const [timer, resolve] of timers) {
        clearTimeout(timer);
        resolve();
      }
      timers.clear();
    };
    const session: Globals = new Globals({
      readSource: (filename) => {
        if (this.recoverySources && !Object.hasOwn(this.recoverySources, filename))
          throw new Error(`Checkpoint source is missing: ${filename}`);
        const source = this.recoverySources
          ? this.recoverySources[filename]
          : this.workspace.readSource(filename);
        this.checkpointSources[filename] = source;
        return source;
      },
      sourcePaths: {
        separator: '/',
        isAbsolute: (name) => name.startsWith('/'),
        getParent: (name) => (name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : '')
      },
      readInput: (request) =>
        new Promise<string>((resolve) => {
          if (disposed || session.simulator.isStopRequested()) {
            resolve(this.inputText);
            return;
          }
          this.inputText = '';
          this.inputRequest = request;
          this.resolveInput = resolve;
          this.messageTab = 'Run I/O';
        }),
      printString: (text) => {
        if (!disposed) {
          this.runIO = (this.runIO + text).slice(-Globals.maximumMessageCharacters);
          this.messageTab = 'Run I/O';
        }
      },
      yieldControl: (milliseconds) =>
        new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            timers.delete(timer);
            resolve();
          }, milliseconds);
          timers.set(timer, resolve);
        }),
      releaseInput: () => {
        this.completeInput(false);
        wake();
      },
      refresh: () => this.controller?.refresh(),
      preferences: browserEnginePreferences()
    });
    // Assembly uses the active source and explicit includes; retire any saved assemble-all preference.
    session.getSettings().setBooleanSetting(Settings.ASSEMBLE_ALL_ENABLED, false);
    this.machine = session;
    const controls = new RunController(session);
    this.controller = controls;
    this.engineSettings = this.readEngineSettings(session);
    // Keep publication bookkeeping outside reactive state: refresh may run inside a display effect.
    let programs = controls.getState().programs;
    const release = controls.subscribe((state) => {
      if (!disposed) {
        if (state.programs !== programs) this.labelSelection = null;
        programs = state.programs;
        this.execution = state;
      }
    });
    this.execution = controls.getState();
    return () => {
      disposed = true;
      this.disposed = true;
      release();
      void controls
        .dispose()
        .finally(wake)
        .catch((error: unknown) => {
          // The removed desktop cannot display a cleanup failure; retain it in browser diagnostics.
          console.error('MARS desktop teardown failed.', error);
        });
    };
  }
  /** Write a persisted engine setting and invalidate or refresh execution as required. */
  updateEngineSetting = (id: number, value: boolean) => {
    this.machine?.getSettings().setBooleanSetting(id, value);
    this.engineSettings = { ...this.engineSettings, [id]: value };
    if (
      ![
        Settings.POPUP_SYSCALL_INPUT,
        Settings.ASSEMBLE_ON_OPEN_ENABLED,
        Settings.SELF_MODIFYING_CODE_ENABLED
      ].includes(id)
    )
      this.controller?.invalidate();
    else this.controller?.refresh();
  };
  /** Resolve the pending syscall once, preserving echo, newline, and maximum-length rules. */
  completeInput = (appendNewline: boolean) => {
    const resolve = this.resolveInput;
    const request = this.inputRequest;
    if (!resolve || !request) return;
    this.resolveInput = undefined;
    const consoleInput = request.prompt === null;
    const text = this.inputText + (appendNewline && consoleInput ? '\n' : '');
    this.inputRequest = null;
    this.runIO = (this.runIO + (consoleInput ? text : `**** user input : ${text}\n`)).slice(
      -Globals.maximumMessageCharacters
    );
    resolve(consoleInput && request.maxLength >= 0 ? text.slice(0, request.maxLength) : text);
  };
  /** Update inline console input and complete at a newline or the syscall character limit. */
  consoleInputChanged = (event: Event) => {
    this.inputText = (event.currentTarget as HTMLTextAreaElement).value;
    const newline = this.inputText.indexOf('\n');
    if (newline >= 0) {
      this.inputText = this.inputText.slice(0, newline) + this.inputText.slice(newline + 1) + '\n';
      this.completeInput(false);
    } else if (
      this.inputRequest &&
      this.inputRequest.maxLength >= 0 &&
      this.inputText.length >= this.inputRequest.maxLength
    )
      this.completeInput(false);
  };
  /** Toggle one instruction address in the configured breakpoint set. */
  toggleBreakpoint = (address: number) => {
    this.breakpoints = this.breakpoints.includes(address)
      ? this.breakpoints.filter((value) => value !== address)
      : [...this.breakpoints, address];
  };
  /** Assemble the active source and explicit includes, publishing diagnostics and the execution view. */
  assemble = () => {
    if (!this.controller || !this.workspace.current) return;
    try {
      this.checkpointSources = Object.create(null);
      const diagnostics = this.controller.assemble(
        [this.workspace.current.name],
        this.workspace.current.name
      );
      if (diagnostics) this.messages += diagnostics.generateErrorAndWarningReport();
      if (this.controller.getState().status === 'assembled') {
        this.messages += `Assemble: operation completed successfully.\n\n`;
        this.breakpoints = [];
        this.breakpointsEnabled = true;
        this.display.view = 'Execute';
      } else this.messages += 'Assemble: operation completed with errors.\n';
    } catch (error) {
      this.report(error);
      this.messages += 'Assemble: operation completed with errors.\n\n';
    }
    this.messageTab = 'Mars Messages';
  };
  private readEngineSettings(machine: Globals): Record<number, boolean> {
    return Object.fromEntries(
      engineOptions.map((option) => [option.id, machine.getSettings().getBooleanSetting(option.id)])
    );
  }
  /** Rebuild captured sources without changing Edit buffers, then restore stable hardware and history. */
  restoreExecution(saved: SavedExecution): void {
    this.recoverySources = saved.sources;
    this.checkpointSources = Object.create(null);
    try {
      this.controller!.restoreCheckpoint(saved.machine);
      const selection = saved.labelSelection;
      if (selection) {
        const table =
          selection.filename === null
            ? this.machine!.symbolTable
            : this.execution?.programs
                .find((program) => program.getFilename() === selection.filename)
                ?.getLocalSymbolTable();
        if (table?.getSymbol(selection.name)?.getAddress() === selection.address)
          this.labelSelection = selection;
      }
      this.engineSettings = this.readEngineSettings(this.machine!);
    } finally {
      this.recoverySources = null;
    }
  }
  /** Dispatch debugger actions through RunController and publish their existing diagnostics. */
  runCommand = async (command: string) => {
    if (!this.controller) return;
    try {
      if (command === 'assemble') {
        this.assemble();
        return;
      }
      if (command === 'clearBreakpoints') {
        this.breakpoints = [];
        return;
      }
      if (command === 'toggleBreakpoints') {
        this.breakpointsEnabled = !this.breakpointsEnabled;
        return;
      }
      if (command === 'pause') {
        this.controller.pause();
        return;
      }
      if (command === 'stop') {
        this.controller.stop();
        return;
      }
      this.display.view = 'Execute';
      if (command === 'reset') {
        this.controller.reset();
        this.runIO += '\nReset: reset completed.\n\n';
        this.display.registerTab = 'Registers';
        return;
      }
      if (command === 'backstep') {
        this.controller.backStep();
        return;
      }
      this.messageTab = 'Run I/O';
      const name = command === 'step' ? 'Step' : 'Go';
      const filename = this.machine?.program?.getFilename() ?? '';
      if (command === 'step') await this.controller.step();
      else {
        this.messages += `Go: running ${filename}\n\n`;
        await this.controller.run(this.breakpointsEnabled ? this.breakpoints : []);
      }
      if (this.disposed) return;
      const result = this.controller.getState();
      if (result.error) {
        this.messages += result.error.errors()?.generateErrorReport() ?? '';
        this.messages += `\n${name}: execution terminated with errors.\n\n`;
        this.messageTab = 'Mars Messages';
        this.display.registerTab = 'Coproc 0';
      } else if (result.status === 'terminated') {
        if (command === 'step') {
          const cliff = result.reason === Simulator.CLIFF_TERMINATION;
          this.messages += `\nStep: execution ${cliff ? 'terminated due to null instruction.' : 'completed successfully.'}\n\n`;
          this.runIO += `\n-- program is finished running ${cliff ? '(dropped off bottom)' : ''} --\n\n`;
          this.messageTab = 'Run I/O';
        } else if (result.reason === Simulator.NORMAL_TERMINATION) {
          this.messages += '\nGo: execution completed successfully.\n\n';
          this.runIO += '\n-- program is finished running --\n\n';
          this.messageTab = 'Run I/O';
        } else if (result.reason === Simulator.CLIFF_TERMINATION) {
          this.messages += '\nGo: execution terminated by null instruction.\n\n';
          this.runIO += '\n-- program is finished running (dropped off bottom) --\n\n';
          this.messageTab = 'Run I/O';
        } else if (result.reason === Simulator.PAUSE_OR_STOP) {
          this.messages += '\nGo: execution terminated by user.\n\n';
          this.messageTab = 'Mars Messages';
        }
      } else if (command === 'go' && result.status === 'paused') {
        this.messages += `Go: execution paused ${result.reason === Simulator.BREAKPOINT ? 'at breakpoint' : 'by user'}: ${filename}\n\n`;
        this.messageTab = 'Mars Messages';
      }
    } catch (error) {
      if (!this.disposed) this.report(error);
    }
  };
  /** Append an error to Mars Messages, preserving translated processing diagnostics. */
  report = (error: unknown) => {
    this.messages += `${error instanceof ProcessingException ? (error.errors()?.generateErrorAndWarningReport() ?? '') : errorMessage(error)}\n`;
    this.messageTab = 'Mars Messages';
  };
}
