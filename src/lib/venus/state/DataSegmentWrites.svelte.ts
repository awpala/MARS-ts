/* Ports write observation in mars/venus/DataSegmentWindow.java and TextSegmentWindow.java.
 * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license. */
import type { Globals } from '#lib/engine/Globals.js';
import { Settings } from '#lib/engine/Settings.js';
import { AccessNotice } from '#lib/engine/hardware/notices/AccessNotice.js';
import type { MemoryAccessNotice } from '#lib/engine/hardware/notices/MemoryAccessNotice.js';
import type { RunController, RunState } from '../RunController.js';
import { segmentBases } from '../utils/debugger/memoryView.js';
import type { DisplayPreferences } from './DisplayPreferences.svelte.js';

/** Observes one machine for the desktop lifetime so Edit/Execute changes preserve the last store. */
export class DataSegmentWrites {
  /** Highlighted word, replaced even on another write to the same address for scrolling. */
  lastWrite = $state.raw<{ address: number } | null>(null);
  /** Whether a stepped or timed run has enabled write highlighting since assembly or Reset. */
  highlighting = $state(false);
  private observedText: Record<number, number | undefined> = {};
  /** Snapshot live text after assembly or silent checkpoint restoration for subsequent change detection. */
  captureText(machine: Globals, statements: RunState['statements']): void {
    this.observedText = {};
    for (const statement of statements) {
      const address = statement.getAddress();
      this.observedText[address] =
        machine.memory.getStatementNoNotify(address)?.getBinaryStatement() ??
        statement.getBinaryStatement();
    }
  }
  /** Follow stepped, timed, and Backstep writes with a highlight, page selection, and scroll. Controller publications synchronously adjust subscriptions: unlimited runs observe only text ranges when self-modification is enabled, and changes to loaded instructions remain visible when ordinary data observation is off. Return teardown for the controller and memory subscriptions. */
  observe(machine: Globals, controller: RunController, display: DisplayPreferences): () => void {
    let statements: RunState['statements'] | undefined;
    const observe = (notice: MemoryAccessNotice) => {
      if (notice.getAccessType() !== AccessNotice.WRITE) return;
      const address = notice.getAddress() & ~3;
      const previousCode = this.observedText[address];
      const currentCode =
        previousCode === undefined ||
        !(machine.memory.inTextSegment(address) || machine.memory.inKernelTextSegment(address))
          ? undefined
          : machine.memory.getStatementNoNotify(address)?.getBinaryStatement();
      const changedCode = currentCode !== undefined && currentCode !== previousCode;
      if (changedCode) this.observedText[address] = currentCode;
      if (!controller.isObservingWrites() && !controller.isBackStepping() && !changedCode) return;
      display.selectMemoryAddress(machine.memory, segmentBases(machine), address);
      this.lastWrite = { address };
    };
    let mode: 'all' | 'text' | 'none' | undefined;
    let releases: (() => void)[] = [];
    // Controller publication is synchronous, so the first Step/timed write is observed before Svelte effects run.
    const releaseController = controller.subscribe((state) => {
      if (statements !== state.statements) {
        statements = state.statements;
        this.captureText(machine, statements);
        this.lastWrite = null;
        this.highlighting = false;
      }
      if (controller.isObservingWrites()) this.highlighting = true;
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
      releaseController();
      releases.forEach((release) => release());
    };
  }
}
