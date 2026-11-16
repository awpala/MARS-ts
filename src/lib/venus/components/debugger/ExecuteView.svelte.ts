/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Shared navigation derives from mars/venus/TextSegmentWindow.java, DataSegmentWindow.java, and LabelsWindow.java. */
import { createContext, tick } from 'svelte';
import type { Symbol as AssemblySymbol } from '#lib/engine/assembler/symbols/Symbol.js';
import { Binary, NumberFormatException } from '#lib/engine/formatting/Binary.js';
import type { Globals } from '#lib/engine/Globals.js';
import { Settings } from '#lib/engine/Settings.js';
import { AccessNotice } from '#lib/engine/hardware/notices/AccessNotice.js';
import type { MemoryAccessNotice } from '#lib/engine/hardware/notices/MemoryAccessNotice.js';
import type { RunController, RunState } from '../../RunController.js';
import type { DisplayPreferences } from '../../state/DisplayPreferences.svelte.js';
import type { SimulationState } from '../../state/SimulationState.svelte.js';
import { errorMessage } from '#lib/browser/errorMessage.js';
import {
  locateAddress,
  pageStart,
  readDisplayWord,
  segmentBases,
  type SegmentBases
} from '../../utils/debugger/memoryView.js';
import { centerBelowHeading } from '../../utils/dom/scrollReveal.js';
import { formatInteger } from '../../utils/debugger/tableCells.js';

/** The machine under inspection, supplied by the Execute view's parent, which guarantees it exists for the view's whole lifetime. */
export interface ExecuteSource {
  /** Prefix of every DOM ID the panes generate, unique to the mounted Execute view. */
  readonly id: string;
  /** Initialized machine; all reads use its public, non-notifying interfaces. */
  readonly machine: Globals;
  /** Session controller; identifies synchronous backstep writes and observed runs. */
  readonly controller: RunController;
  /** Latest controller snapshot; its revision invalidates views after machine changes. */
  readonly snapshot: RunState;
}

/** Navigation, formatting, memory access, and write observation for one mounted Execute view. Display and simulation owners retain persisted range, page, label selection, and display bases; this view owns transient highlights and edit errors. Panes access it through context; the mounting component starts observeWrites, resetObservation, and revealSelection in effects and owns their cleanup. */
export class ExecuteView {
  private readonly source: ExecuteSource;
  private readonly display: DisplayPreferences;
  private readonly simulation: SimulationState;
  /** Failure text from the latest manual memory or code edit; empty when the edit succeeded. */
  memoryError = $state('');
  /** Word address of the most recent observed write, or null after assembly or Reset. */
  editedAddress = $state<number | null>(null);
  /** Whether an observed (stepped or timed) run has started since the last assembly or Reset. */
  memoryHighlighting = $state(false);
  /** Assembled statements, stable between assemblies. */
  statements = $derived.by(() => this.source.snapshot.statements);
  /** Whether the controller is running. */
  running = $derived.by(() => this.source.snapshot.status === 'running');
  /** Base address of every Data Segment range, refreshed with the machine. */
  bases: SegmentBases = $derived.by(() => {
    void this.source.snapshot.revision;
    return segmentBases(this.source.machine);
  });
  /** First address of the page the Data Segment displays. */
  memoryBase = $derived.by(() =>
    pageStart(this.bases, this.display.dataSegment, this.display.dataPageOffset)
  );
  /** Word address of the selected label, or null when none is selected. */
  selectedLabelWord = $derived.by(() =>
    this.simulation.labelSelection === null ? null : this.simulation.labelSelection.address & ~3
  );
  private memoryReveal = 0;
  private observedText: Record<number, number | undefined> = {};

  /** Bind to the mounted machine and the desktop owners of the values this view follows. */
  constructor(source: ExecuteSource, display: DisplayPreferences, simulation: SimulationState) {
    this.source = source;
    this.display = display;
    this.simulation = simulation;
  }

  /** DOM ID prefix for this view. */
  get id(): string {
    return this.source.id;
  }
  /** Machine under inspection. */
  get machine(): Globals {
    return this.source.machine;
  }
  /** Session controller. */
  get controller(): RunController {
    return this.source.controller;
  }
  /** Latest controller snapshot. */
  get snapshot(): RunState {
    return this.source.snapshot;
  }

  /** DOM ID of the Text Segment row holding an instruction address. */
  instructionId(address: number): string {
    return `${this.id}-instruction-${address >>> 0}`;
  }
  /** DOM ID of the Data Segment cell holding a word address. */
  memoryId(address: number): string {
    return `${this.id}-memory-${address >>> 0}`;
  }
  /** DOM ID of a Labels row. */
  labelRowId(filename: string | null, name: string): string {
    return `${this.id}-label-${encodeURIComponent(filename ?? '(global)')}-${encodeURIComponent(name)}`;
  }

  /** Format an address in the selected base; decimal addresses are unsigned. */
  formatAddress(address: number): string {
    return formatInteger(address, this.display.hexAddresses, true);
  }
  /** Format a Data Segment word as ASCII or in the selected base. */
  formatWord(value: number): string {
    return this.display.ascii
      ? Binary.intToAscii(value)
      : formatInteger(value, this.display.hexValues);
  }
  /** Read a word for display without notifying observers. */
  readWord(address: number): number {
    return readDisplayWord(this.machine, address);
  }

  /** Write the word an edited cell holds, then redisplay what memory now contains; invalid text is flagged in the cell and other failures are reported. */
  changeWord(address: number, input: HTMLInputElement, code = false): void {
    try {
      this.machine.withGuiAccess(() =>
        this.machine.memory.setRawWord(address, Binary.stringToInt(input.value.trim()))
      );
      this.memoryError = '';
      this.simulation.refresh();
    } catch (error) {
      if (error instanceof NumberFormatException) {
        input.value = 'INVALID';
        return;
      }
      this.memoryError = errorMessage(error);
    }
    input.value = code
      ? Binary.intToHexString(this.readWord(address))
      : this.formatWord(this.readWord(address));
  }

  /** Whether a symbol is the selected label of its table. */
  isSelectedLabel(symbol: AssemblySymbol, filename: string | null): boolean {
    const selected = this.simulation.labelSelection;
    return (
      selected?.filename === filename &&
      selected.name === symbol.getName() &&
      selected.address === symbol.getAddress()
    );
  }

  /** Show the page holding an address and return whether it lies in a text segment. */
  selectMemoryPage(address: number): boolean {
    const located = locateAddress(
      this.machine.memory,
      this.bases,
      address,
      this.display.dataSegment
    );
    this.display.dataSegment = located.segment;
    this.display.dataPageOffset = located.pageOffset;
    return located.textLabel;
  }

  /** Select or deselect a label and, when selecting, page the Data Segment to it and reveal and focus its target. */
  async navigateLabel(symbol: AssemblySymbol, filename: string | null): Promise<void> {
    if (this.isSelectedLabel(symbol, filename)) {
      this.simulation.labelSelection = null;
      return;
    }
    const address = symbol.getAddress();
    const textLabel = this.selectMemoryPage(address);
    this.simulation.labelSelection = { filename, name: symbol.getName(), address };
    await tick();
    const word = document.getElementById(this.memoryId(address & ~3));
    this.revealTarget(word);
    if (textLabel) {
      const instruction = document.getElementById(this.instructionId(address));
      this.revealTarget(instruction);
      instruction?.focus({ preventScroll: true });
    } else word?.focus({ preventScroll: true });
  }

  /** Center a row or cell in its own pane without moving the desktop. */
  revealTarget(target: HTMLElement | null): void {
    const viewport = target?.closest<HTMLElement>('.text-scroll, .data-scroll, .labels-scroll');
    if (target && viewport) centerBelowHeading(viewport, target);
  }

  /** Reveal the selected label in every pane after the next render, such as when reopening Execute or restoring a session. Returns the cancellation for an effect. */
  revealSelection(): (() => void) | undefined {
    const selection = this.simulation.labelSelection;
    if (selection === null) return;
    const address = selection.address & ~3;
    let active = true;
    void tick().then(() => {
      if (!active) return;
      this.revealTarget(document.getElementById(this.instructionId(address)));
      this.revealTarget(document.getElementById(this.memoryId(address)));
      this.revealTarget(
        document.getElementById(this.labelRowId(selection.filename, selection.name))
      );
    });
    return () => {
      active = false;
    };
  }

  /** Follow stepped, timed, and Backstep writes with a highlight, page selection, and scroll. Controller publications synchronously adjust subscriptions: unlimited runs observe only text ranges when self-modification is enabled, and changes to loaded instructions remain visible when ordinary data observation is off. Return effect teardown for subscriptions and pending reveals. */
  observeWrites(): () => void {
    const { machine, controller } = this.source;
    const observe = (notice: MemoryAccessNotice) => {
      if (notice.getAccessType() !== AccessNotice.WRITE) return;
      const address = notice.getAddress() & ~3;
      const previousCode = this.observedText[address];
      const currentCode =
        previousCode === undefined
          ? undefined
          : machine.memory.getStatementNoNotify(address)?.getBinaryStatement();
      const changedCode = previousCode !== undefined && currentCode !== previousCode;
      if (changedCode && currentCode !== undefined) this.observedText[address] = currentCode;
      if (!controller.isObservingWrites() && !controller.isBackStepping() && !changedCode) return;
      this.editedAddress = address;
      this.selectMemoryPage(address);
      const reveal = ++this.memoryReveal;
      void tick().then(() => {
        if (reveal === this.memoryReveal)
          this.revealTarget(document.getElementById(this.memoryId(address)));
      });
    };
    let mode: 'all' | 'text' | 'none' | undefined;
    let releases: (() => void)[] = [];
    // Controller publication is synchronous, so the first Step/timed write is observed before Svelte effects run.
    const releaseController = controller.subscribe((state) => {
      if (controller.isObservingWrites()) this.memoryHighlighting = true;
      const next =
        state.status !== 'running' || controller.isObservingWrites()
          ? 'all'
          : machine.getSettings().getBooleanSetting(Settings.SELF_MODIFYING_CODE_ENABLED)
            ? 'text'
            : 'none';
      if (next === mode) return;
      mode = next;
      releases.forEach((release) => release());
      const memory = machine.memory;
      releases =
        mode === 'all'
          ? [memory.addObserver(observe)]
          : mode === 'text'
            ? [
                memory.addObserver(observe, memory.textBaseAddress, memory.textLimitAddress - 4),
                memory.addObserver(
                  observe,
                  memory.kernelTextBaseAddress,
                  memory.kernelTextLimitAddress - 4
                )
              ]
            : [];
    });
    return () => {
      this.memoryReveal++;
      releaseController();
      releases.forEach((release) => release());
    };
  }

  /** Clear write highlighting and re-capture instruction words after Assemble or Reset replace the statements, as the legacy run actions call clearHighlighting(). */
  resetObservation(): void {
    const { machine } = this.source;
    this.observedText = Object.fromEntries(
      this.statements.map((statement) => [
        statement.getAddress(),
        machine.memory.getStatementNoNotify(statement.getAddress())?.getBinaryStatement() ??
          statement.getBinaryStatement()
      ])
    );
    this.editedAddress = null;
    this.memoryHighlighting = false;
    this.memoryReveal++;
  }
}

/** Execute-view context: install in the Execute owner during initialization and read in its panes. Missing providers throw. */
export const [getExecuteView, setExecuteView] = createContext<ExecuteView>();
