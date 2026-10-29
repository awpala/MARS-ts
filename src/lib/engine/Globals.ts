/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/Globals.java machine ownership and initialization; see MARSlicense.txt. */
import { Settings, type SettingsHost } from './Settings.js';
import { Assembler, type AssemblerHost } from './assembler/Assembler.js';
import { MIPSprogram, type MIPSprogramHost } from './assembler/programs/MIPSprogram.js';
import {
  ProgramStatement,
  type ProgramStatementHost
} from './assembler/programs/ProgramStatement.js';
import { SymbolTable } from './assembler/symbols/SymbolTable.js';
import { Tokenizer, type TokenizerSourceHost } from './assembler/tokenization/Tokenizer.js';
import type { TokenClassificationContext } from './assembler/tokenization/TokenTypes.js';
import type { AccessOrigin } from './hardware/notices/AccessNotice.js';
import { Memory } from './hardware/memory/Memory.js';
import { MemoryConfigurations } from './hardware/memory/MemoryConfigurations.js';
import { RegisterFile } from './hardware/registers/RegisterFile.js';
import { Coprocessor0 } from './hardware/registers/Coprocessor0.js';
import { Coprocessor1 } from './hardware/registers/Coprocessor1.js';
import { InstructionSet } from './instructions/InstructionSet.js';
import { SystemIO, type InputRequest } from './io/SystemIO.js';
import { RandomStreams } from './syscalls/random/RandomStreams.js';
import { DialogIO, type DialogIOHost } from './io/DialogIO.js';
import { JavaFloatingPoint } from './formatting/JavaFloatingPoint.js';
import { BackStepper } from './simulator/BackStepper.js';
import { DelayedBranch } from './simulator/DelayedBranch.js';
import { Exceptions } from './simulator/Exceptions.js';
import { Simulator } from './simulator/Simulator.js';
import { SyscallLoader } from './syscalls/SyscallLoader.js';
import type { SyscallOverride } from './syscalls/SyscallOverride.js';
import type { SyscallRegistration } from './syscalls/SyscallRegistration.js';

/** Browser/test services needed to own one independent MARS machine; no DOM or process globals enter the engine. */
export interface GlobalsHost {
  /** Read current source from explicitly available virtual buffers; includes use this same service. */
  readSource(filename: string): string;
  /** Resolve virtual source paths without directory discovery. */
  sourcePaths: Pick<TokenizerSourceHost, 'separator' | 'isAbsolute' | 'getParent'>;
  /** Read one console or same-tab modal input. */
  readInput(request: InputRequest): string | Promise<string>;
  /** Append exact syscall output to the owning console. */
  printString(text: string): void;
  /** Entropy for newly used unseeded streams; seeded services never require this capability. */
  randomSeed?(): bigint;
  /** Same-tab or test dialog capability; required only when executing dialog services. */
  dialogs?: DialogIOHost;
  /** Cooperatively yield or wait using the platform's scheduler. */
  yieldControl(milliseconds: number): Promise<void>;
  /** Release pending console/dialog input when the simulator requests pause or stop. */
  releaseInput?(): void;
  /** Close host-owned program files when assembly or simulation resets descriptors. */
  resetFiles?(): void;
  /** Notify the GUI that timed execution should refresh its non-notifying views. */
  refresh?(): void;
  /** Optional persistent preference operations. */
  preferences?: Omit<SettingsHost, 'backSteppingEnabled'>;
  /** Canonical fatal/configuration diagnostics; absent routes them to console output. */
  writeDiagnostic?(message: string): void;
  /** Optional internal debug sink, active only while this machine's debug flag is true. */
  debug?(message: string): void;
  /** Additional/alternative translated services explicitly registered for this session. */
  syscallRegistrations?: readonly SyscallRegistration[];
  /** Explicit parsed service overrides; canonical defaults retain their existing numbers. */
  syscallOverrides?: readonly SyscallOverride[];
  /** Maximum instructions between unlimited-speed host yields. */
  instructionsPerYield?: number;
}

/** Former Java globals become one instance per IDE session; GUI workflows are owned by RunController. */
export class Globals {
  /** MARS-ts target release. */
  static readonly version = '1.0';
  /** Canonical source-file extensions from Config.properties. */
  static readonly fileExtensions = Object.freeze(['asm', 's']);
  /** Canonical message-buffer limit from Config.properties. */
  static readonly maximumMessageCharacters = 1000000;
  /** Canonical assembler diagnostic limit from Config.properties. */
  static readonly maximumErrorMessages = 200;
  /** Canonical undo-history limit from Config.properties. */
  static readonly maximumBacksteps = 2000;
  /** Original attribution. */
  static readonly copyrightHolders = 'Pete Sanderson and Kenneth Vollmar';
  /** Current GUI program, replaced when the controller begins a new assembly. */
  program: MIPSprogram | null = null;
  /** Internal diagnostic toggle, isolated to this session. */
  debug = false;
  /** Legacy run-speed value: 40 denotes unlimited execution. */
  runSpeed = 40;
  /** Actual instruction registry and simulation callbacks. */
  readonly instructionSet: InstructionSet;
  /** Global symbols shared by programs in this machine. */
  readonly symbolTable: SymbolTable;
  /** Session memory and its observers. */
  readonly memory: Memory<ProgramStatement>;
  /** Session's three canonical address layouts. */
  readonly memoryConfigurations: MemoryConfigurations;
  /** Integer registers, HI/LO, and PC. */
  readonly registerFile: RegisterFile;
  /** Exception registers. */
  readonly coprocessor0: Coprocessor0;
  /** Floating registers and condition flags. */
  readonly coprocessor1: Coprocessor1;
  /** Delayed-branch state. */
  readonly delayedBranch: DelayedBranch;
  /** Actual execution loop. */
  readonly simulator: Simulator;
  /** Session-owned platform console. */
  readonly systemIO: SystemIO;
  /** Session-owned random streams; Reset and Backstep do not rewind their seeds. */
  readonly randomStreams: RandomStreams;
  /** Session-owned platform dialog boundary. */
  readonly dialogs: DialogIO;
  /** Session-owned service registry. */
  readonly syscallLoader: SyscallLoader;
  private readonly settings: Settings;
  private readonly programHost: MIPSprogramHost;
  private readonly assemblerHost: AssemblerHost;
  private readonly statementHost: ProgramStatementHost;
  private initialized = false;
  private guiAccessDepth = 0;
  private readonly stopInputSubscription: () => void;

  /** Compose real translated classes and initialize the instruction set exactly once for this instance. */
  constructor(private readonly host: GlobalsHost) {
    this.settings = new Settings({
      readPreference: (key) => host.preferences?.readPreference?.(key) ?? null,
      writePreference: (key, value) => host.preferences?.writePreference?.(key, value),
      backSteppingEnabled: () => this.program?.backSteppingEnabled() ?? false
    });
    const debug = host.debug
      ? (message: string) => {
          if (this.debug) host.debug!(message);
        }
      : undefined;
    const origin = (): AccessOrigin =>
      this.guiAccessDepth > 0 ? 'gui' : this.simulator?.isRunning() ? 'mips' : 'gui';
    const history = () =>
      this.settings.getBackSteppingEnabled() ? this.program!.getBackStepper() : null;
    this.memoryConfigurations = new MemoryConfigurations((configuration) => {
      this.memory.clear();
      this.registerFile.getUserRegister('$gp')!.changeResetValue(configuration.getGlobalPointer());
      this.registerFile.getUserRegister('$sp')!.changeResetValue(configuration.getStackPointer());
      this.registerFile
        .getProgramCounterRegister()
        .changeResetValue(configuration.getTextBaseAddress());
      this.registerFile.initializeProgramCounter(configuration.getTextBaseAddress());
      this.registerFile.resetRegisters();
    });
    this.registerFile = new RegisterFile(this.memoryConfigurations.getCurrentConfiguration(), {
      addRegisterFileRestore: (register, value) =>
        history()?.addRegisterFileRestore(register, value) ?? value,
      addPCRestore: (value) => {
        history()?.addPCRestore(value);
      },
      getStartAtMain: () => this.settings.getStartAtMain(),
      getStartAddress: () => {
        const address = this.symbolTable.getAddress('main');
        return address !== SymbolTable.NOT_FOUND &&
          (this.memory.inTextSegment(address) || this.memory.inKernelTextSegment(address))
          ? address
          : null;
      },
      getAccessOrigin: origin
    });
    this.coprocessor0 = new Coprocessor0(
      (register, value) => history()?.addCoprocessor0Restore(register, value) ?? value,
      origin
    );
    this.coprocessor1 = new Coprocessor1({
      addCoprocessor1Restore: (register, value) =>
        history()?.addCoprocessor1Restore(register, value) ?? value,
      addConditionFlagClear: (flag) => {
        history()?.addConditionFlagClear(flag);
      },
      addConditionFlagSet: (flag) => {
        history()?.addConditionFlagSet(flag);
      },
      getAccessOrigin: origin
    });
    this.delayedBranch = new DelayedBranch();
    this.statementHost = {
      registerFile: this.registerFile,
      coprocessor1: this.coprocessor1,
      findByBinaryCode: (word) => this.instructionSet.findByBinaryCode(word),
      matchOperator: (name) => this.instructionSet.matchOperator(name),
      getDisplayAddressesInHex: () => this.settings.getDisplayAddressesInHex(),
      getDisplayValuesInHex: () => this.settings.getDisplayValuesInHex()
    };
    this.memory = new Memory(
      {
        decodeStatement: (word, address) => new ProgramStatement(word, address, this.statementHost),
        isSelfModifyingCodeEnabled: () =>
          this.settings.getBooleanSetting(Settings.SELF_MODIFYING_CODE_ENABLED),
        notificationsEnabled: () => this.program !== null,
        getAccessOrigin: origin,
        debug,
        addMemoryRestoreRawWord: (address, value) => {
          history()?.addMemoryRestoreRawWord(address, value);
        },
        addMemoryRestoreWord: (address, value) =>
          history()?.addMemoryRestoreWord(address, value) ?? value,
        addMemoryRestoreHalf: (address, value) =>
          history()?.addMemoryRestoreHalf(address, value) ?? value,
        addMemoryRestoreByte: (address, value) =>
          history()?.addMemoryRestoreByte(address, value) ?? value
      },
      this.memoryConfigurations
    );
    this.symbolTable = new SymbolTable('global', null, debug ?? null);
    const exceptions = new Exceptions(this.coprocessor0, this.registerFile);
    const exceptionHost = {
      getProgramCounter: () => this.registerFile.getProgramCounter(),
      setRegisters: (cause: number, address?: number) => exceptions.setRegisters(cause, address)
    };
    this.systemIO = new SystemIO({
      readInput: (request) => host.readInput(request),
      printString: (text) => host.printString(text),
      getPopupSyscallInput: () => this.settings.getBooleanSetting(Settings.POPUP_SYSCALL_INPUT),
      resetFiles: () => host.resetFiles?.(),
      parseFloat: (text) => JavaFloatingPoint.parseFloat(text),
      parseDouble: (text) => JavaFloatingPoint.parseDouble(text),
      formatFloat: (value) => JavaFloatingPoint.formatFloat(value),
      formatDouble: (value) => JavaFloatingPoint.formatDouble(value)
    });
    const diagnostic = (message: string) =>
      host.writeDiagnostic ? host.writeDiagnostic(message) : host.printString(message);
    this.randomStreams = new RandomStreams(() => {
      if (!host.randomSeed) throw new Error('Unseeded random syscalls require a random seed host');
      return host.randomSeed();
    });
    this.dialogs = new DialogIO(host.dialogs);
    this.syscallLoader = new SyscallLoader(
      {
        registerFile: this.registerFile,
        coprocessor1: this.coprocessor1,
        memory: this.memory,
        systemIO: this.systemIO,
        exceptionHost,
        randomStreams: this.randomStreams,
        dialogs: this.dialogs
      },
      host.syscallRegistrations,
      host.syscallOverrides,
      diagnostic
    );
    const classification: TokenClassificationContext = {
      registerFile: this.registerFile,
      coprocessor0: this.coprocessor0,
      coprocessor1: this.coprocessor1,
      instructionSet: { matchOperator: (name) => this.instructionSet.matchOperator(name) }
    };
    this.instructionSet = new InstructionSet({
      registerFile: this.registerFile,
      coprocessor0: this.coprocessor0,
      coprocessor1: this.coprocessor1,
      memory: this.memory,
      delayedBranch: this.delayedBranch,
      exceptionHost,
      findSyscall: (number) => this.syscallLoader.findSyscall(number),
      getDelayedBranchingEnabled: () => this.settings.getDelayedBranchingEnabled(),
      tokenizeExampleInstruction: (example) =>
        new Tokenizer(classification).tokenizeExampleInstruction(example),
      write: diagnostic
    });
    this.simulator = new Simulator({
      memory: this.memory,
      registerFile: this.registerFile,
      coprocessor0: this.coprocessor0,
      delayedBranch: this.delayedBranch,
      exceptionHost,
      resetFiles: () => this.systemIO.resetFiles(),
      getRunSpeed: () => this.runSpeed,
      yieldControl: (milliseconds) => host.yieldControl(milliseconds),
      refresh: () => host.refresh?.(),
      instructionsPerYield: host.instructionsPerYield
    });
    this.stopInputSubscription = this.simulator.addStopListener(() => host.releaseInput?.());
    this.assemblerHost = {
      ...this.statementHost,
      ...classification,
      registerFile: this.registerFile,
      coprocessor1: this.coprocessor1,
      instructionSet: { matchOperator: (name) => this.instructionSet.matchOperator(name) },
      memory: this.memory,
      symbolTable: this.symbolTable,
      getDelayedBranchingEnabled: () => this.settings.getDelayedBranchingEnabled(),
      getBareMachineEnabled: () => this.settings.getBareMachineEnabled(),
      resetFiles: () => this.systemIO.resetFiles(),
      debug
    };
    this.programHost = {
      readSource: (filename) => host.readSource(filename),
      sourcePaths: host.sourcePaths,
      classification,
      globalSymbolTable: this.symbolTable,
      createAssembler: () => this.createAssembler(),
      createBackStepper: () =>
        new BackStepper(
          {
            memory: this.memory,
            registerFile: this.registerFile,
            coprocessor0: this.coprocessor0,
            coprocessor1: this.coprocessor1,
            inDelaySlot: () => this.simulator.inDelaySlot(),
            fatal: (message, status) => {
              diagnostic(message);
              throw new Error(`MARS fatal exit ${status}: ${message}`);
            }
          },
          Globals.maximumBacksteps
        ),
      registerFile: this.registerFile,
      simulator: {
        simulate: (program, pc, maxSteps, breakpoints, actor) =>
          this.simulator.simulate(
            program,
            pc,
            maxSteps,
            breakpoints === null ? null : [...breakpoints],
            actor
          )
      },
      debug,
      maximumErrorMessages: Globals.maximumErrorMessages
    };
    this.initialize();
  }
  /** Idempotently populate this instance's actual instruction/service tables and clear its configured memory. */
  initialize(): void {
    if (this.initialized) return;
    this.syscallLoader.loadSyscalls();
    this.instructionSet.populate();
    this.initialized = true;
    this.debug = false;
    this.memoryConfigurations.setCurrentConfiguration(
      this.memoryConfigurations.getConfigurationByName(this.settings.getMemoryConfiguration())
    );
    this.memory.clear();
  }
  /** Return this machine's settings, never a process-global singleton. */
  getSettings(): Settings {
    return this.settings;
  }
  /** Construct a program bound to this machine's actual collaborators and current virtual sources. */
  createProgram(): MIPSprogram {
    return new MIPSprogram(this.programHost);
  }
  /** Construct the canonical assembler for this machine. */
  createAssembler(): Assembler {
    return new Assembler(this.assemblerHost);
  }
  /** Mark synchronous GUI reads/writes explicitly while execution may be awaiting input; never pass an async callback. */
  withGuiAccess<T>(operation: () => T): T {
    this.guiAccessDepth++;
    try {
      return operation();
    } finally {
      this.guiAccessDepth--;
    }
  }
  /** Remove composition-owned subscriptions after the controller has stopped and awaited execution. */
  dispose(): void {
    this.stopInputSubscription();
    this.systemIO.resetFiles();
  }
}
