import { isRandomStreamsState } from '#lib/engine/syscalls/random/RandomStreams.js';
import type { Globals } from '#lib/engine/Globals.js';
import { isMemoryState, type MemoryState } from '#lib/engine/hardware/memory/Memory.js';
import type { ProgramStatement } from '#lib/engine/assembler/programs/ProgramStatement.js';
import { Settings } from '#lib/engine/Settings.js';
import type { RunState } from './RunController.js';

/** Portable stable machine payload; no engine instances, pending input, or browser resources. */
export interface RunCheckpoint {
  /** Original lead source identity; sources are supplied separately by the browser owner. */
  filename: string;
  /** Live engine settings, including handler preferences for future assemblies. */
  settings: ReturnType<Settings['captureState']>;
  /** Handler used by the loaded assembly, or null; older checkpoints fall back to their saved settings. Changing future assembly preferences never changes loaded code. */
  assemblyExceptionHandler?: string | null;
  /** Configured address-layout identity. */
  configuration: string;
  /** Sparse raw memory and live instruction words. */
  memory: MemoryState;
  /** Session stream IDs and internal 48-bit seeds; absent in older checkpoints. */
  randomStreams?: [number, number][];
  /** Integer registers followed by HI, LO, and PC. */
  registers: number[];
  /** Exception register raw words, in hardware register order. */
  coprocessor0: number[];
  /** Floating registers as raw words, preserving NaN payloads. */
  coprocessor1: number[];
  /** Raw eight condition bits. */
  conditionFlags: number;
  /** Pending delayed branch state and its original target. */
  branch: {
    /** Canonical pending-branch phase at the checkpoint. */
    state: 'clear' | 'registered' | 'triggered';
    /** Original signed branch target, including a retained nested-branch target. */
    target: number;
  };
  /** Unconsumed device interrupt identifier. */
  interrupt: number;
  /** Whether the last entry point used single-step execution. */
  stepped: boolean;
  /** Stable controller status; running is never serialized. */
  status: Exclude<RunState['status'], 'running'>;
  /** Whether this assembly has started execution. */
  started: boolean;
  /** Whether the machine remains at its assembly/reset state. */
  reset: boolean;
  /** Canonical simulator stop reason. */
  reason: number;
  /** Whether error highlighting should point at the preceding instruction. */
  error: boolean;
  /** Exact signed PC from the last simulator stop; older checkpoints omit this display metadata. */
  lastExecutedAddress?: number | null;
  /** Retained history recording preference and restoration records. */
  history: {
    /** Whether recording and restoration are enabled. */
    enabled: boolean;
    /** Oldest-first bounded restoration records. */
    records: {
      /** Canonical BackStepAction identifier. */
      action: number;
      /** Original instruction PC, or minus one for an unresolvable GUI edit. */
      pc: number;
      /** First canonical restore argument. */
      param1: number;
      /** Second canonical restore argument. */
      param2: number;
      /** Whether the original instruction occupied a delayed branch slot. */
      inDelaySlot: boolean;
      /** Index into historical statement identities, or null for no statement. */
      statement: number | null;
    }[];
  };
  /** Historical statement identities, including superseded self-modified instructions. */
  historyStatements: {
    /** Original instruction address. */
    address: number;
    /** Raw signed instruction word, including superseded self-modified code. */
    word: number;
    /** Whether this identity is still the live memory statement. */
    live: boolean;
  }[];
}

/** Words in `registers`: the 32 integer registers followed by HI, LO, and PC. */
const REGISTER_WORDS = 35;
/** Words in `coprocessor0`: the exception registers. */
const COPROCESSOR0_WORDS = 4;
/** Words in `coprocessor1`: the floating registers. */
const COPROCESSOR1_WORDS = 32;

/** Validate the complete serialized payload before any restored machine mutation. */
export function isRunCheckpoint(value: unknown): value is RunCheckpoint {
  if (!value || typeof value !== 'object') return false;
  const s = value as RunCheckpoint;
  const word = (v: unknown): v is number => typeof v === 'number' && (v | 0) === v;
  const words = (v: unknown, length: number) =>
    Array.isArray(v) && v.length === length && v.every(word);
  return (
    typeof s.filename === 'string' &&
    s.filename.length > 0 &&
    (s.assemblyExceptionHandler === undefined ||
      s.assemblyExceptionHandler === null ||
      typeof s.assemblyExceptionHandler === 'string') &&
    typeof s.configuration === 'string' &&
    !!s.settings &&
    Array.isArray(s.settings.booleans) &&
    s.settings.booleans.length === Settings.BOOLEAN_COUNT &&
    s.settings.booleans.every((v) => typeof v === 'boolean') &&
    Array.isArray(s.settings.strings) &&
    s.settings.strings.length === Settings.STRING_COUNT &&
    s.settings.strings.every((v) => typeof v === 'string') &&
    isMemoryState(s.memory) &&
    (s.randomStreams === undefined || isRandomStreamsState(s.randomStreams)) &&
    words(s.registers, REGISTER_WORDS) &&
    words(s.coprocessor0, COPROCESSOR0_WORDS) &&
    words(s.coprocessor1, COPROCESSOR1_WORDS) &&
    word(s.conditionFlags) &&
    s.conditionFlags >= 0 &&
    s.conditionFlags <= 255 &&
    !!s.branch &&
    ['clear', 'registered', 'triggered'].includes(s.branch.state) &&
    word(s.branch.target) &&
    word(s.interrupt) &&
    typeof s.stepped === 'boolean' &&
    ['idle', 'assembled', 'paused', 'terminated', 'error'].includes(s.status) &&
    typeof s.started === 'boolean' &&
    typeof s.reset === 'boolean' &&
    word(s.reason) &&
    typeof s.error === 'boolean' &&
    (s.lastExecutedAddress === undefined ||
      s.lastExecutedAddress === null ||
      word(s.lastExecutedAddress)) &&
    Array.isArray(s.historyStatements) &&
    s.historyStatements.length <= 2000 &&
    s.historyStatements.every(
      (ps) => !!ps && word(ps.address) && word(ps.word) && typeof ps.live === 'boolean'
    ) &&
    !!s.history &&
    typeof s.history.enabled === 'boolean' &&
    Array.isArray(s.history.records) &&
    s.history.records.length <= 2000 &&
    s.history.records.every(
      (r) =>
        !!r &&
        word(r.action) &&
        r.action >= 0 &&
        r.action <= 10 &&
        word(r.pc) &&
        word(r.param1) &&
        word(r.param2) &&
        typeof r.inDelaySlot === 'boolean' &&
        (r.statement === null ||
          (Number.isInteger(r.statement) &&
            r.statement >= 0 &&
            r.statement < s.historyStatements.length))
    )
  );
}

/** Integer registers followed by HI, LO, and PC, matching the serialized `registers` order. */
function checkpointRegisters(machine: Globals) {
  const file = machine.registerFile;
  return [
    ...file.getRegisters(),
    file.getHighOrderRegister(),
    file.getLowOrderRegister(),
    file.getProgramCounterRegister()
  ];
}

/** Capture idle hardware, bounded history, and the exact simulator stop address (default null) without notices or mutable engine references. */
export function captureRunCheckpoint(
  machine: Globals,
  state: RunState,
  lastExecutedAddress: number | null = null
): RunCheckpoint {
  if (state.status === 'running' || machine.simulator.isRunning() || !machine.program)
    throw new Error('A checkpoint requires an idle loaded program');
  const historyStatements: RunCheckpoint['historyStatements'] = [];
  const identities = new Map<ProgramStatement, number>();
  const history = machine.program.getBackStepper()?.captureState();
  const records = (history?.records ?? []).map(({ ps, ...record }) => {
    let statement: number | null = null;
    if (ps) {
      statement = identities.get(ps) ?? null;
      if (statement === null) {
        statement = historyStatements.length;
        identities.set(ps, statement);
        historyStatements.push({
          address: ps.getAddress(),
          word: ps.getBinaryStatement(),
          live: machine.memory.getStatementNoNotify(ps.getAddress()) === ps
        });
      }
    }
    return { ...record, statement };
  });
  return {
    filename: machine.program.getFilename()!,
    settings: machine.getSettings().captureState(),
    configuration: machine.memoryConfigurations
      .getCurrentConfiguration()
      .getConfigurationIdentifier(),
    memory: machine.memory.captureState(),
    randomStreams: machine.randomStreams.captureState(),
    registers: checkpointRegisters(machine).map((r) => r.getValueNoNotify()),
    coprocessor0: machine.coprocessor0.getRegisters().map((r) => r.getValueNoNotify()),
    coprocessor1: machine.coprocessor1.getRegisters().map((r) => r.getValueNoNotify()),
    conditionFlags: machine.coprocessor1.getConditionFlagsNoNotify(),
    branch: {
      state: machine.delayedBranch.isRegistered()
        ? 'registered'
        : machine.delayedBranch.isTriggered()
          ? 'triggered'
          : 'clear',
      target: machine.delayedBranch.getBranchTargetAddress()
    },
    interrupt: machine.simulator.externalInterruptingDevice,
    stepped: machine.program.inSteppedExecution(),
    status: state.status,
    started: state.started,
    reset: state.reset,
    reason: state.reason,
    error: state.error !== null,
    lastExecutedAddress,
    history: { enabled: history?.enabled ?? true, records },
    historyStatements
  };
}

/** Apply validated hardware after the controller reassembles captured sources; no code is executed or output replayed. */
export function restoreRunHardware(machine: Globals, checkpoint: RunCheckpoint): void {
  machine.memory.restoreState(checkpoint.memory);
  machine.randomStreams.restoreState(checkpoint.randomStreams ?? []);
  checkpointRegisters(machine).forEach((r, i) => r.setValue(checkpoint.registers[i]));
  machine.coprocessor0.getRegisters().forEach((r, i) => r.setValue(checkpoint.coprocessor0[i]));
  machine.coprocessor1.getRegisters().forEach((r, i) => r.setValue(checkpoint.coprocessor1[i]));
  for (let i = 0; i < 8; i++) {
    if ((checkpoint.conditionFlags & (1 << i)) !== 0) machine.coprocessor1.setConditionFlag(i);
    else machine.coprocessor1.clearConditionFlag(i);
  }
  machine.delayedBranch.clear();
  if (checkpoint.branch.state !== 'clear') {
    machine.delayedBranch.register(checkpoint.branch.target);
    if (checkpoint.branch.state === 'triggered') machine.delayedBranch.trigger();
  }
  machine.simulator.externalInterruptingDevice = checkpoint.interrupt;
  machine.program!.restoreSteppedExecution(checkpoint.stepped);
  const statements = checkpoint.historyStatements.map((s) => {
    const live = s.live ? machine.memory.getStatementNoNotify(s.address) : null;
    return live?.getBinaryStatement() === s.word
      ? live
      : machine.memory.decodeCheckpointStatement(s.word, s.address);
  });
  machine.program!.getBackStepper()!.restoreState({
    enabled: checkpoint.history.enabled,
    records: checkpoint.history.records.map(({ statement, ...record }) => ({
      ...record,
      ps: statement === null ? null : statements[statement]
    }))
  });
}
