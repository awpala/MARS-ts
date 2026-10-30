/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Settings workflows derive from mars/venus/SettingsDelayedBranchingAction.java,
 * SettingsSelfModifyingCodeAction.java, SettingsMemoryConfigurationAction.java,
 * and SettingsExceptionHandlerAction.java. */
import type {
  MessageTab,
  SavedExecution,
  SavedLabelSelection
} from '#lib/browser/DesktopSession.js';
import { browserEnginePreferences } from '#lib/browser/EnginePreferences.js';
import { WebAudioToneHost } from '#lib/browser/WebAudioToneHost.js';
import { Globals } from '#lib/engine/Globals.js';
import { ProcessingException } from '#lib/engine/diagnostics/ProcessingException.js';
import { Settings } from '#lib/engine/Settings.js';
import type { DialogRequest } from '#lib/engine/io/DialogIO.js';
import type { InputRequest } from '#lib/engine/io/SystemIO.js';
import { RunController } from '../RunController.js';
import { engineOption, engineOptions } from '../utils/commands/settings.js';
import { errorMessage } from '../utils/errors/errorMessage.js';
import { describeRunOutcome, type RunCommand } from '../utils/execution/runOutcome.js';
import { buildFileNameList } from '../utils/execution/buildFileNameList.js';
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
  /** Whether Go supplies configured breakpoints to the simulator; a change during Go applies to that run. */
  breakpointsEnabled = $state(true);
  /** Reactive values of settings exposed in desktop menus. */
  engineSettings = $state<Record<number, boolean>>({});
  /** Desktop-owned argument draft; retained across assemblies and saved with desktop presentation. */
  programArguments = $state('');
  /** Pending syscall request, or null when no input is owed. */
  inputRequest = $state.raw<InputRequest | null>(null);
  /** Pending service 50–59 modal, independent of optional console-input popups. */
  dialogRequest = $state.raw<DialogRequest | null>(null);
  /** Draft dialog value; the engine receives it without console trimming, bounds, or echo. */
  dialogText = $state('');
  private resolveDialog: ((value: string | number | null) => void) | undefined;
  /** Current pending input buffer. */
  inputText = $state('');
  private resolveInput: ((text: string) => void) | undefined = undefined;
  /** Whether the current controller snapshot is running. */
  running = $derived(this.execution?.status === 'running');
  /** Filename of the assembled program that is loaded in the machine, independent of the Edit selection; undefined when none is loaded. */
  loadedFilename = $derived(
    this.execution?.programs
      .find((program) => program === this.machine?.program && program.getMachineList() !== null)
      ?.getFilename()
  );
  /** Whether a syscall is waiting for text typed into the Run I/O console rather than a popup. */
  consoleInputPending = $derived(this.inputRequest?.prompt === null);
  /** Selected output pane. */
  messageTab = $state<MessageTab>('Mars Messages');
  /** Assembler and execution diagnostics. */
  messages = $state('');
  /** Console output and echoed input. */
  runIO = $state('');
  /** Exact virtual sources read for the loaded assembly, independent of later Edit selection. */
  checkpointSources: Record<string, string> = Object.create(null);
  private recoverySources: Record<string, string> | null = null;
  /** Machine code of the most recent successful build, or null before one; an identical rebuild keeps breakpoints. */
  private buildSignature: string | null = null;
  private disposed = false;
  /** Sound output of the current machine; Go and Step prepare it within their user gesture. */
  private tones: WebAudioToneHost | undefined;
  /** Compose the machine host with source resolution and display navigation owned by this desktop. */
  constructor(
    private readonly workspace: SourceWorkspace,
    private readonly display: DisplayPreferences
  ) {}
  /** Publish a revision after a manual machine edit so execution views re-read the hardware. */
  refresh = (): void => this.controller?.refresh();
  /** Request Stop of the running program, releasing pending host input. */
  stop = (): void => this.controller?.stop();
  /** Clear selected output, or both outputs when all is true, preserving selection and pending input. */
  clearOutput = (all = false): void => {
    if (all || this.messageTab === 'Mars Messages') this.messages = '';
    if (all || this.messageTab === 'Run I/O') this.runIO = '';
  };
  /** Initialize browser host services and the machine; return teardown for subscriptions, pending input, tones, and scheduler timers. */
  start(): () => void {
    let disposed = false;
    const tones = new WebAudioToneHost();
    this.tones = tones;
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
      randomSeed: () => {
        const words = crypto.getRandomValues(new Uint32Array(2));
        return (BigInt(words[0]) << 32n) | BigInt(words[1]);
      },
      dialogs: {
        showConfirmDialog: async (message) => {
          const value = await this.requestDialog(
            { kind: 'confirm', message, messageType: 3 },
            disposed || session.simulator.isStopRequested()
          );
          return typeof value === 'number' ? value : -1;
        },
        showInputDialog: async (message) => {
          const value = await this.requestDialog(
            { kind: 'input', message, messageType: 3 },
            disposed || session.simulator.isStopRequested()
          );
          return typeof value === 'string' ? value : null;
        },
        showMessageDialog: async (message, messageType) => {
          await this.requestDialog(
            { kind: 'message', message, messageType },
            disposed || session.simulator.isStopRequested()
          );
        }
      },
      tones: {
        // A tone started after Stop or Pause still sounds, but the stopping run does not wait for it.
        playTone: (tone) => {
          const end = tones.playTone(tone);
          return disposed || session.simulator.isStopRequested() ? Promise.resolve() : end;
        }
      },
      printString: (text) => {
        if (!disposed) {
          this.appendRunIO(text);
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
        this.completeDialog(null);
        tones.release();
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
      tones.dispose();
      this.tones = undefined;
      void controls
        .dispose()
        .finally(wake)
        .catch((error: unknown) => {
          // The removed desktop cannot display a cleanup failure; retain it in browser diagnostics.
          console.error('MARS desktop teardown failed.', error);
        });
    };
  }
  /** Persist an idle-machine setting; delayed branching reassembles loaded code as in SettingsDelayedBranchingAction.java. */
  updateEngineSetting = (id: number, value: boolean) => {
    if (!this.machine || this.controller?.isBusy() || this.engineSettings[id] === value) return;
    this.machine.getSettings().setBooleanSetting(id, value);
    this.engineSettings = { ...this.engineSettings, [id]: value };
    if (id === Settings.DELAYED_BRANCHING_ENABLED && this.hasLoadedProgram()) {
      this.assemble();
      return;
    }
    if (engineOption(id)?.invalidatesAssembly ?? true) this.controller?.invalidate();
    else this.controller?.refresh();
  };
  /** Apply a known layout while idle, persist its identifier, and rebuild loaded code as in SettingsMemoryConfigurationAction.java. */
  updateMemoryConfiguration = (identifier: string): void => {
    const machine = this.machine;
    if (!machine || this.controller?.isBusy()) return;
    const configuration = machine.memoryConfigurations.getConfigurationByName(identifier);
    if (!machine.memoryConfigurations.setCurrentConfiguration(configuration)) return;
    machine.getSettings().setMemoryConfiguration(identifier);
    this.display.resetDataView();
    if (this.hasLoadedProgram()) this.assemble();
    else this.controller?.refresh();
  };
  /** Persist handler enablement and selection independently; disabling keeps the selected file, and changes affect only future assemblies, even during execution. */
  updateExceptionHandler = (enabled: boolean, name: string): void => {
    const settings = this.machine?.getSettings();
    if (
      !settings ||
      (settings.getExceptionHandlerEnabled() === enabled && settings.getExceptionHandler() === name)
    )
      return;
    settings.setBooleanSetting(Settings.EXCEPTION_HANDLER_ENABLED, enabled);
    if (settings.getExceptionHandler() !== name) settings.setExceptionHandler(name);
    this.controller?.refresh();
  };
  private requestDialog(request: DialogRequest, stopped: boolean): Promise<string | number | null> {
    if (stopped) return Promise.resolve(null);
    this.dialogText = '';
    this.dialogRequest = request;
    return new Promise((resolve) => {
      this.resolveDialog = resolve;
    });
  }
  /** Resolve the active dialog once; Cancel and dismissal resume execution, while Stop separately requests simulator termination. */
  completeDialog = (value: string | number | null): void => {
    const resolve = this.resolveDialog;
    if (!resolve) return;
    this.resolveDialog = undefined;
    this.dialogRequest = null;
    resolve(value);
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
    this.appendRunIO(consoleInput ? text : `**** user input : ${text}\n`);
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
  /** Toggle one instruction address in the configured breakpoint set, including during Go. */
  toggleBreakpoint = (address: number) => {
    this.breakpoints = this.breakpoints.includes(address)
      ? this.breakpoints.filter((value) => value !== address)
      : [...this.breakpoints, address];
    this.updateRunningBreakpoints();
  };
  /** Breakpoints Go supplies to the simulator: the configured list unless suspended. */
  private activeBreakpoints(): readonly number[] {
    return this.breakpointsEnabled ? this.breakpoints : [];
  }
  /** Apply a breakpoint change to an in-flight Go at its next instruction boundary. */
  private updateRunningBreakpoints(): void {
    this.controller?.updateBreakpoints(this.activeBreakpoints());
  }
  /** Assemble the active source and explicit includes, publishing diagnostics and the execution view. */
  assemble = () => {
    const filename = this.workspace.current?.readOnly
      ? this.loadedFilename
      : this.workspace.current?.name;
    if (!this.controller || !filename) return;
    try {
      this.checkpointSources = Object.create(null);
      const diagnostics = this.controller.assemble([filename], filename, (filenames) => {
        this.messages += buildFileNameList('Assemble: assembling ', filenames);
      });
      if (diagnostics) this.messages += diagnostics.generateErrorAndWarningReport();
      if (this.controller.getState().status === 'assembled') {
        this.messages += `Assemble: operation completed successfully.\n\n`;
        const signature = this.loadedBuildSignature();
        if (signature !== this.buildSignature) {
          this.breakpoints = [];
          this.breakpointsEnabled = true;
        }
        this.buildSignature = signature;
        this.display.resetExecuteView();
        this.display.view = 'Execute';
      } else this.messages += 'Assemble: operation completed with errors.\n';
    } catch (error) {
      this.report(error);
      this.messages += 'Assemble: operation completed with errors.\n\n';
    }
    this.messageTab = 'Mars Messages';
  };
  /** Filenames, addresses, and binary statements of every loaded program, in assembly order. */
  private loadedBuildSignature(): string {
    return (this.controller?.getState().programs ?? [])
      .map(
        (program) =>
          `${program.getFilename()}\n${(program.getMachineList() ?? [])
            .map((statement) => `${statement.getAddress()}:${statement.getBinaryStatement()}`)
            .join('\n')}`
      )
      .join('\n\n');
  }
  private hasLoadedProgram(): boolean {
    const state = this.execution;
    return !!state && state.status !== 'idle' && (state.status !== 'error' || state.started);
  }
  private readEngineSettings(machine: Globals): Record<number, boolean> {
    return Object.fromEntries(
      engineOptions.map((option) => [option.id, machine.getSettings().getBooleanSetting(option.id)])
    );
  }
  /** Rebuild captured sources without changing Edit buffers, then restore stable hardware and history while retaining current handler preferences for future assemblies. */
  restoreExecution(saved: SavedExecution): void {
    this.recoverySources = saved.sources;
    this.checkpointSources = Object.create(null);
    try {
      const settings = this.machine!.getSettings();
      const handlerEnabled = settings.getExceptionHandlerEnabled();
      const handlerName = settings.getExceptionHandler();
      this.controller!.restoreCheckpoint(saved.machine);
      // Handler preferences can change during a run while recovery retains the preceding stable machine.
      const restoredSettings = settings.captureState();
      restoredSettings.booleans[Settings.EXCEPTION_HANDLER_ENABLED] = handlerEnabled;
      restoredSettings.strings[Settings.EXCEPTION_HANDLER] = handlerName;
      settings.restoreState(restoredSettings);
      this.buildSignature = this.loadedBuildSignature();
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
        this.updateRunningBreakpoints();
        return;
      }
      if (command === 'toggleBreakpoints') {
        this.breakpointsEnabled = !this.breakpointsEnabled;
        this.updateRunningBreakpoints();
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
        this.display.resetExecuteView();
        this.appendRunIO('\nReset: reset completed.\n\n');
        return;
      }
      if (command === 'backstep') {
        this.controller.backStep();
        return;
      }
      this.messageTab = 'Run I/O';
      // Browser autoplay policy permits sound only when the context starts within this user gesture.
      this.tones?.prepare();
      const run: RunCommand = command === 'step' ? 'step' : 'go';
      const filename = this.machine?.program?.getFilename() ?? '';
      if (run === 'step') await this.controller.step(this.programArguments);
      else {
        if (this.display.clearAllOutputsOnGo && !this.controller.getState().started)
          this.clearOutput(true);
        this.messages += `Go: running ${filename}\n\n`;
        await this.controller.run(this.activeBreakpoints(), -1, this.programArguments);
      }
      if (this.disposed) return;
      const outcome = describeRunOutcome(run, this.controller.getState(), filename);
      this.messages += outcome.messages;
      this.appendRunIO(outcome.runIO);
      if (outcome.messageTab) this.messageTab = outcome.messageTab;
      if (outcome.registerTab) this.display.registerTab = outcome.registerTab;
    } catch (error) {
      this.report(error);
    }
  };
  /** Append program console text, keeping only the most recent characters the console retains. */
  private appendRunIO(text: string): void {
    this.runIO = (this.runIO + text).slice(-Globals.maximumMessageCharacters);
  }
  /** Append an error to Mars Messages, preserving translated processing diagnostics; after teardown, late reports from runs, transfers, and source workflows are ignored. */
  report = (error: unknown) => {
    if (this.disposed) return;
    this.messages += `${error instanceof ProcessingException ? (error.errors()?.generateErrorAndWarningReport() ?? '') : errorMessage(error)}\n`;
    this.messageTab = 'Mars Messages';
  };
}
