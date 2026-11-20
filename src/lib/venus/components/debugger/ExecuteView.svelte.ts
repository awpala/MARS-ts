/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Shared navigation derives from mars/venus/TextSegmentWindow.java, DataSegmentWindow.java, and LabelsWindow.java. */
import { createContext, tick } from 'svelte';
import type { Symbol as AssemblySymbol } from '#lib/engine/assembler/symbols/Symbol.js';
import { Binary, NumberFormatException } from '#lib/engine/formatting/Binary.js';
import type { Globals } from '#lib/engine/Globals.js';
import type { RunController, RunState } from '../../RunController.js';
import type { DisplayPreferences } from '../../state/DisplayPreferences.svelte.js';
import type { SimulationState } from '../../state/SimulationState.svelte.js';
import { errorMessage } from '#lib/browser/errorMessage.js';
import {
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

/** Navigation, formatting, memory access, and write observation for one mounted Execute view. Display and simulation owners retain persisted range, page, label selection, and display bases; the simulation owns write highlights and this view owns edit errors. Panes access it through context; the mounting component starts revealWrite and revealSelection in effects and owns their cleanup. */
export class ExecuteView {
  private readonly source: ExecuteSource;
  private readonly display: DisplayPreferences;
  private readonly simulation: SimulationState;
  /** Failure text from the latest manual memory or code edit; empty when the edit succeeded. */
  memoryError = $state('');
  /** Word address of the most recent observed write, or null after assembly or Reset. */
  get editedAddress() {
    return this.simulation.dataWrites.lastWrite?.address ?? null;
  }
  /** Whether an observed (stepped or timed) run has started since the last assembly or Reset. */
  get memoryHighlighting() {
    return this.simulation.dataWrites.highlighting;
  }
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
    return this.display.selectMemoryAddress(this.machine.memory, this.bases, address);
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

  /** Center the last observed write after its table page renders, preserving focus. */
  revealWrite(): (() => void) | undefined {
    const write = this.simulation.dataWrites.lastWrite;
    if (!write) return;
    let active = true;
    void tick().then(() => {
      if (active) this.revealTarget(document.getElementById(this.memoryId(write.address)));
    });
    return () => {
      active = false;
    };
  }
}

/** Execute-view context: install in the Execute owner during initialization and read in its panes. Missing providers throw. */
export const [getExecuteView, setExecuteView] = createContext<ExecuteView>();
