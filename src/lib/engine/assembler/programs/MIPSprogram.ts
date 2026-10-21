/* Copyright (c) 2003–2006 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/MIPSprogram.java; see MARSlicense.txt. */
import { ErrorList } from '../../diagnostics/ErrorList.js';
import { ErrorMessage } from '../../diagnostics/ErrorMessage.js';
import { ProcessingException } from '../../diagnostics/ProcessingException.js';
import type { RegisterFile } from '../../hardware/registers/RegisterFile.js';
import type { SimulatorAction } from '../../simulator/SimulatorAction.js';
import type { BackStepper } from '../../simulator/BackStepper.js';
import { MacroPool } from '../macros/MacroPool.js';
import type { ProgramStatement } from './ProgramStatement.js';
import type { SourceLine } from '../tokenization/SourceLine.js';
import { SymbolTable } from '../symbols/SymbolTable.js';
import type { TokenList } from '../tokenization/TokenList.js';
import {
  Tokenizer,
  type TokenizerProgram,
  type TokenizerSourceHost
} from '../tokenization/Tokenizer.js';
import type { TokenClassificationContext } from '../tokenization/TokenTypes.js';

/** Real assembler operations invoked by a program; constructed fresh for each assembly. */
export interface ProgramAssembler {
  /** Assemble the supplied already-tokenized programs with the selected policies. */
  assemble(
    programs: readonly MIPSprogram[] | null,
    extended: boolean,
    warningsAreErrors: boolean
  ): ProgramStatement[] | null;
  /** Diagnostics retained by the assembler, including warnings after success. */
  getErrorList(): ErrorList | null;
}
/** Simulator operations consumed by program run and step entry points. */
export interface ProgramSimulator {
  /** Execute using the session simulator; action is an opaque host-owned completion controller. */
  simulate(
    program: MIPSprogram,
    pc: number,
    maxSteps: number,
    breakpoints: readonly number[] | null,
    action: SimulatorAction | null
  ): Promise<boolean>;
}
/** Session-owned source buffers, machine collaborators, and platform boundaries. */
export interface MIPSprogramHost {
  /** Read current source text from the host's virtual files or open editor buffers. */
  readSource(filename: string): string;
  /** Format a read failure using the platform's equivalent of Java Exception.toString(). */
  describeReadError?(error: unknown): string;
  /** Path operations for include resolution; no directory enumeration is requested. */
  sourcePaths: Pick<TokenizerSourceHost, 'separator' | 'isAbsolute' | 'getParent'>;
  /** Actual session instruction and register lookup services. */
  classification: TokenClassificationContext;
  /** Session global labels shared by this program's local symbol table. */
  globalSymbolTable: SymbolTable;
  /** Construct the actual assembler for this session. */
  createAssembler(): ProgramAssembler;
  /** Construct fresh undo history after assembly succeeds. */
  createBackStepper(): BackStepper<ProgramStatement>;
  /** Session program counter. */
  registerFile: Pick<RegisterFile, 'getProgramCounter'>;
  /** Actual session simulator. */
  simulator: ProgramSimulator;
  /** Optional canonical tokenizer/symbol-table debug output. */
  debug?: (message: string) => void;
  /** Maximum accumulated errors; defaults to the canonical Globals setting. */
  maximumErrorMessages?: number;
}

/** One program's source, tokens, parsed/assembled statements, macros, and execution mode. */
export class MIPSprogram {
  private steppedExecution = false;
  private filename: string | null = null;
  private sourceList: string[] | null = null;
  private tokenList: TokenList[] | null = null;
  private parsedList: ProgramStatement[] | null = null;
  private machineList: ProgramStatement[] | null = null;
  private backStepper: BackStepper<ProgramStatement> | null = null;
  private localSymbolTable: SymbolTable | null = null;
  private macroPool: MacroPool | null = null;
  private sourceLineList: SourceLine<TokenizerProgram>[] | null = null;
  private tokenizer: Tokenizer | null = null;
  /** Bind this program to its owning machine and virtual-source services. */
  constructor(private readonly host: MIPSprogramHost) {}
  /** Mutable source strings, or null before source loading. */
  getSourceList(): string[] | null {
    return this.sourceList;
  }
  /** Retain the mapping list by reference and snapshot its current source strings. */
  setSourceLineList(lines: SourceLine<TokenizerProgram>[]): void {
    this.sourceLineList = lines;
    this.sourceList = [];
    for (const line of lines) this.sourceList.push(line.getSource());
  }
  /** Original/expanded line mappings, or null before tokenization. */
  getSourceLineList(): SourceLine<TokenizerProgram>[] | null {
    return this.sourceLineList;
  }
  /** Filename exactly as supplied by the source host, or null before loading. */
  getFilename(): string | null {
    return this.filename;
  }
  /** Tokenized lines, or null before successful tokenization. */
  getTokenList(): TokenList[] | null {
    return this.tokenList;
  }
  /** The latest tokenizer, retained even when it reports lexical errors. */
  getTokenizer(): Tokenizer | null {
    return this.tokenizer;
  }
  /** Replace and return the mutable parsed-statement list. */
  createParsedList(): ProgramStatement[] {
    this.parsedList = [];
    return this.parsedList;
  }
  /** Parsed statements, or null until explicitly created by assembly. */
  getParsedList(): ProgramStatement[] | null {
    return this.parsedList;
  }
  /** Machine statements from the most recent successful assembler call. */
  getMachineList(): ProgramStatement[] | null {
    return this.machineList;
  }
  /** Undo history created after successful assembly, or null otherwise. */
  getBackStepper(): BackStepper<ProgramStatement> | null {
    return this.backStepper;
  }
  /** Local labels created after successful tokenization, or null before it. */
  getLocalSymbolTable(): SymbolTable | null {
    return this.localSymbolTable;
  }
  /** Whether this program has enabled undo history. */
  backSteppingEnabled(): boolean {
    return this.backStepper !== null && this.backStepper.enabled();
  }
  /** One-based source line, or null outside the loaded source range. */
  getSourceLine(line: number): string | null {
    return line >= 1 && line <= this.sourceList!.length ? this.sourceList![line - 1] : null;
  }
  /** Read current virtual source text using BufferedReader-compatible line boundaries. */
  readSource(filename: string): void {
    this.filename = filename;
    this.sourceList = [];
    try {
      const source = this.host.readSource(filename);
      if (source.length !== 0) {
        const lines = source.split(/\r\n|\n|\r/);
        if (lines[lines.length - 1] === '') lines.pop();
        for (const line of lines) this.sourceList.push(line);
      }
    } catch (error) {
      const errors = new ErrorList(this.host.maximumErrorMessages);
      errors.add(
        new ErrorMessage(null, 0, 0, this.host.describeReadError?.(error) ?? String(error))
      );
      throw new ProcessingException(errors);
    }
  }
  /** Tokenize loaded source and initialize local labels only after tokenization succeeds. */
  tokenize(): void {
    const paths = this.host.sourcePaths;
    const sourceHost: TokenizerSourceHost = {
      separator: paths.separator,
      isAbsolute: (filename) => paths.isAbsolute(filename),
      getParent: (filename) => paths.getParent(filename),
      readSource: (filename) => {
        const program = new MIPSprogram(this.host);
        program.readSource(filename);
        return program;
      }
    };
    this.tokenizer = new Tokenizer(
      this.host.classification,
      null,
      sourceHost,
      this.host.debug ?? null,
      this.host.maximumErrorMessages
    );
    this.tokenList = this.tokenizer.tokenize(this);
    this.localSymbolTable = new SymbolTable(
      this.filename,
      this.host.globalSymbolTable,
      this.host.debug ?? null
    );
  }
  /** Read/tokenize exactly the supplied files, preserving exception-handler and lead ordering. */
  prepareFilesForAssembly(
    filenames: string[],
    leadFilename: string | null,
    exceptionHandler: string | null
  ): MIPSprogram[] {
    const programs: MIPSprogram[] = [];
    let leadPosition = 0;
    if (exceptionHandler !== null && exceptionHandler.length > 0) {
      filenames.splice(0, 0, exceptionHandler);
      leadPosition = 1;
    }
    for (const filename of filenames) {
      const program = filename === leadFilename ? this : new MIPSprogram(this.host);
      program.readSource(filename);
      program.tokenize();
      if (program === this && programs.length > 0) programs.splice(leadPosition, 0, program);
      else programs.push(program);
    }
    return programs;
  }
  /** Delegate assembly and create fresh undo history only after successful completion. */
  assemble(
    programs: readonly MIPSprogram[] | null,
    extended: boolean,
    warningsAreErrors = false
  ): ErrorList | null {
    this.backStepper = null;
    const assembler = this.host.createAssembler();
    this.machineList = assembler.assemble(programs, extended, warningsAreErrors);
    this.backStepper = this.host.createBackStepper();
    return assembler.getErrorList();
  }
  /** Run from the current PC with either breakpoints or an instruction-count limit. */
  simulate(breakpointsOrMaxSteps: readonly number[] | number | null): Promise<boolean> {
    return typeof breakpointsOrMaxSteps === 'number'
      ? this.simulateFromPC(null, breakpointsOrMaxSteps, null)
      : this.simulateFromPC(breakpointsOrMaxSteps, -1, null);
  }
  /** Run from the current PC, marking this program as continuous execution. */
  simulateFromPC(
    breakpoints: readonly number[] | null,
    maxSteps: number,
    action: SimulatorAction | null
  ): Promise<boolean> {
    this.steppedExecution = false;
    return this.host.simulator.simulate(
      this,
      this.host.registerFile.getProgramCounter(),
      maxSteps,
      breakpoints,
      action
    );
  }
  /** Run one instruction from the current PC, retaining stepped mode afterward. */
  simulateStepAtPC(action: SimulatorAction | null): Promise<boolean> {
    this.steppedExecution = true;
    return this.host.simulator.simulate(
      this,
      this.host.registerFile.getProgramCounter(),
      1,
      null,
      action
    );
  }
  /** Restore the debugger's stable stepped-mode annotation without starting execution. */
  restoreSteppedExecution(stepped: boolean): void {
    this.steppedExecution = stepped;
  }
  /** Whether the latest execution entry point selected single-step mode. */
  inSteppedExecution(): boolean {
    return this.steppedExecution;
  }
  /** Replace this program's macro pool with a new empty pool. */
  createMacroPool(): MacroPool {
    this.macroPool = new MacroPool(this, this.host.classification);
    return this.macroPool;
  }
  /** Current local macro definitions, or null before pool creation. */
  getLocalMacroPool(): MacroPool | null {
    return this.macroPool;
  }
  /** Retain a supplied macro pool, including null when clearing it. */
  setLocalMacroPool(pool: MacroPool | null): void {
    this.macroPool = pool;
  }
}
