import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Simulator, type SimulatorHost } from './Simulator.js';
import { SimulatorNotice } from './SimulatorNotice.js';
import { BackStepper } from './BackStepper.js';
import { DelayedBranch } from './DelayedBranch.js';
import { Exceptions } from './Exceptions.js';
import { RegisterFile } from '../hardware/registers/RegisterFile.js';
import { Coprocessor0 } from '../hardware/registers/Coprocessor0.js';
import { Coprocessor1 } from '../hardware/registers/Coprocessor1.js';
import { Memory } from '../hardware/memory/Memory.js';
import { ProgramStatement } from '../assembler/programs/ProgramStatement.js';
import { Tokenizer } from '../assembler/tokenization/Tokenizer.js';
import { InstructionSet } from '../instructions/InstructionSet.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';
import { SystemIO, type InputRequest } from '../io/SystemIO.js';
import { SyscallLoader } from '../syscalls/SyscallLoader.js';
import { JavaFloatingPoint } from '../formatting/JavaFloatingPoint.js';

const T = 0x00400000;
interface Scenario {
  id: string;
  words: number[];
  start: number;
  max: number;
  points: number[] | null;
  delayed: boolean;
  t0: number;
  interrupt: number;
  handler: boolean;
  done: boolean | null;
  error: string;
  state: number[];
  branch: boolean[];
  empty: boolean;
  notices: string;
}
const capture = JSON.parse(readFileSync('tests/oracle/simulator-units/golden.json', 'utf8')) as {
  stdout: string;
  stderr: string;
  status: number;
};
const scenarios = capture.stdout
  .trimEnd()
  .split('\n')
  .map((line) => JSON.parse(line) as Scenario);
function machine(
  options: {
    delayed?: boolean;
    readInput?: (request: InputRequest) => string | Promise<string>;
    yieldControl?: SimulatorHost['yieldControl'];
    speed?: number;
  } = {}
) {
  let back: BackStepper<ProgramStatement> | null = null;
  const registers = new RegisterFile(undefined, {
    addRegisterFileRestore: (n, old) =>
      back?.enabled() ? back.addRegisterFileRestore(n, old) : old,
    addPCRestore: (old) => {
      if (back?.enabled()) back.addPCRestore(old);
    }
  });
  const cp0 = new Coprocessor0((n, old) =>
    back?.enabled() ? back.addCoprocessor0Restore(n, old) : old
  );
  const cp1 = new Coprocessor1({
    addCoprocessor1Restore: (n, old) =>
      back?.enabled() ? back.addCoprocessor1Restore(n, old) : old,
    addConditionFlagClear: (n) => {
      if (back?.enabled()) back.addConditionFlagClear(n);
    },
    addConditionFlagSet: (n) => {
      if (back?.enabled()) back.addConditionFlagSet(n);
    }
  });
  const delayedBranch = new DelayedBranch(),
    exceptions = new Exceptions(cp0, registers);
  const exceptionHost = {
    getProgramCounter: () => registers.getProgramCounter(),
    setRegisters: (cause: number, address?: number) => exceptions.setRegisters(cause, address)
  };
  const statementHost = {
    registerFile: registers,
    coprocessor1: cp1,
    findByBinaryCode: (word: number) => instructions.findByBinaryCode(word),
    matchOperator: (name: string) => instructions.matchOperator(name),
    getDisplayAddressesInHex: () => true,
    getDisplayValuesInHex: () => true
  };
  const memory: Memory<ProgramStatement> = new Memory({
    decodeStatement: (word, address) => new ProgramStatement(word, address, statementHost)
  });
  const output: string[] = [];
  const io = new SystemIO({
    readInput: options.readInput ?? (() => ''),
    printString: (text) => output.push(text),
    getPopupSyscallInput: () => false,
    parseFloat: (text) => JavaFloatingPoint.parseFloat(text),
    parseDouble: (text) => JavaFloatingPoint.parseDouble(text),
    formatFloat: (value) => JavaFloatingPoint.formatFloat(value),
    formatDouble: (value) => JavaFloatingPoint.formatDouble(value)
  });
  const loader = new SyscallLoader({
    registerFile: registers,
    coprocessor1: cp1,
    memory,
    systemIO: io,
    exceptionHost
  });
  loader.loadSyscalls();
  const classification = {
    registerFile: registers,
    coprocessor0: cp0,
    coprocessor1: cp1,
    instructionSet: { matchOperator: (name: string) => instructions.matchOperator(name) }
  };
  const instructions: InstructionSet = new InstructionSet({
    registerFile: registers,
    coprocessor0: cp0,
    coprocessor1: cp1,
    memory,
    delayedBranch,
    exceptionHost,
    getDelayedBranchingEnabled: () => options.delayed ?? false,
    findSyscall: (n) => loader.findSyscall(n),
    tokenizeExampleInstruction: (text) =>
      new Tokenizer(classification).tokenizeExampleInstruction(text),
    write: (text) => {
      throw new Error(text);
    }
  });
  instructions.populate();
  let resets = 0,
    refreshes = 0;
  const yields: number[] = [];
  const simulator = new Simulator({
    memory,
    registerFile: registers,
    coprocessor0: cp0,
    delayedBranch,
    exceptionHost,
    resetFiles: () => {
      resets++;
    },
    getRunSpeed: () => options.speed ?? 40,
    yieldControl: async (delay) => {
      yields.push(delay);
      if (yields.length > 100) throw new Error('Fixture exceeded its bounded instruction budget');
      await options.yieldControl?.(delay);
    },
    instructionsPerYield: 2,
    refresh: () => {
      refreshes++;
    }
  });
  const program = {
    backSteppingEnabled: () => back?.enabled() ?? false,
    getBackStepper: () => back
  };
  return {
    registers,
    cp0,
    cp1,
    delayedBranch,
    memory,
    simulator,
    program,
    output,
    yields,
    resets: () => resets,
    refreshes: () => refreshes,
    load(words: number[], t0 = 0, handler = false) {
      back = null;
      memory.clear();
      registers.resetRegisters();
      cp0.resetRegisters();
      cp1.resetRegisters();
      delayedBranch.clear();
      yields.length = 0;
      for (const [i, word] of words.entries())
        memory.setStatement(T + 4 * i, new ProgramStatement(word, T + 4 * i, statementHost));
      if (handler)
        memory.setStatement(
          memory.exceptionHandlerAddress,
          new ProgramStatement(0, memory.exceptionHandlerAddress, statementHost)
        );
      registers.updateRegister(8, t0);
      back = new BackStepper({
        memory,
        registerFile: registers,
        coprocessor0: cp0,
        coprocessor1: cp1,
        inDelaySlot: () => simulator.inDelaySlot(),
        fatal: (message) => {
          throw new Error(message);
        }
      });
    }
  };
}

it('matches Java execution sequencing, architectural state, diagnostics, history and notices', async () => {
  expect(capture.status).toBe(0);
  expect(capture.stderr).toBe('');
  const options = { delayed: false };
  const m = machine(options);
  for (const row of scenarios) {
    options.delayed = row.delayed;
    m.load(row.words, row.t0, row.handler);
    m.simulator.externalInterruptingDevice = row.interrupt;
    const notices: string[] = [];
    const off = m.simulator.subscribe((notice) => notices.push(notice.toString()));
    let done: boolean | null = null,
      error = '';
    try {
      done = await m.simulator.simulate(
        m.program,
        row.start,
        row.max,
        row.points?.slice() ?? null,
        null
      );
    } catch (e) {
      if (!(e instanceof ProcessingException)) throw new Error(row.id, { cause: e });
      error = e.errors()!.generateErrorReport();
    }
    off();
    const state = [
      m.registers.getProgramCounter(),
      m.registers.getValue(8),
      m.registers.getValue(9),
      m.registers.getValue(2),
      m.cp0.getValue(8),
      m.cp0.getValue(12),
      m.cp0.getValue(13),
      m.cp0.getValue(14),
      m.simulator.externalInterruptingDevice
    ];
    expect(
      {
        done,
        error,
        state,
        branch: [m.delayedBranch.isRegistered(), m.delayedBranch.isTriggered()],
        empty: m.program.getBackStepper()!.empty(),
        notices: notices.join('\n')
      },
      row.id
    ).toEqual({
      done: row.done,
      error: Buffer.from(row.error, 'base64').toString(),
      state: row.state,
      branch: row.branch,
      empty: row.empty,
      notices: Buffer.from(row.notices, 'base64').toString()
    });
    expect(m.simulator.isRunning()).toBe(false);
  }
}, 30000);

it('steps, reverses each instruction including nop, and resumes without sharing history', async () => {
  const m = machine(),
    other = machine();
  m.load([0x24080001, 0, 0x25090002]);
  other.load([0]);
  const results: [boolean, number][] = [];
  for (let i = 0; i < 3; i++)
    await m.simulator.simulate(m.program, m.registers.getProgramCounter(), 1, null, {
      name: 'Step',
      stepped: (done, reason) => results.push([done, reason])
    });
  expect(results).toEqual([
    [false, 3],
    [false, 3],
    [false, 3]
  ]);
  expect(m.registers.getValue(9)).toBe(3);
  for (let i = 2; i >= 0; i--) {
    m.program.getBackStepper()!.backStep();
    expect(m.registers.getProgramCounter()).toBe(T + 4 * i);
  }
  expect(m.registers.getValue(8)).toBe(0);
  expect(m.registers.getValue(9)).toBe(0);
  expect(other.program.getBackStepper()!.empty()).toBe(true);
  expect(await m.simulator.simulate(m.program, T, 0, null, null)).toBe(true);
  expect(m.registers.getValue(9)).toBe(3);
});

it('awaits actual input syscalls, retains exclusive ownership, and releases stop listeners', async () => {
  let accept!: (text: string) => void, entered!: () => void;
  const requested = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const m = machine({
    readInput: () =>
      new Promise((resolve) => {
        accept = resolve;
        entered();
      })
  });
  m.load([0x24020005, 0x0000000c, 0x24480001]);
  const callbacks: number[] = [],
    noticeOrder: number[] = [];
  const off1 = m.simulator.subscribe(() => noticeOrder.push(1)),
    off2 = m.simulator.subscribe(() => noticeOrder.push(2));
  const offStop = m.simulator.addStopListener(() => accept('41'));
  const running = m.simulator.simulate(m.program, T, 0, null, {
    name: 'Go',
    paused: (_done, reason) => callbacks.push(reason)
  });
  await requested;
  expect(m.registers.getValue(8)).toBe(0);
  expect(m.simulator.isRunning()).toBe(true);
  await expect(m.simulator.simulate(m.program, T, 1, null, null)).rejects.toThrow('already owns');
  m.simulator.stopExecution({ name: 'Pause' });
  m.simulator.stopExecution({ name: 'Stop' });
  expect(await running).toBe(false);
  expect(m.registers.getValue(2)).toBe(41);
  expect(m.registers.getProgramCounter()).toBe(T + 8);
  expect(callbacks).toEqual([Simulator.PAUSE_OR_STOP]);
  expect(noticeOrder).toEqual([2, 1, 2, 1]);
  offStop();
  off1();
  off2();
  expect(await m.simulator.simulate(m.program, T + 8, 0, null, null)).toBe(true);
  expect(m.registers.getValue(8)).toBe(42);
  expect(noticeOrder).toHaveLength(4);
});

it('yields bounded batches, applies timed delays, and sends canonical completion callbacks', async () => {
  const m = machine({ speed: 2 });
  m.load([0, 0, 0]);
  const stopped: number[] = [];
  await m.simulator.simulate(m.program, T, 0, null, {
    name: 'Go',
    stopped: (_error, reason) => stopped.push(reason)
  });
  expect(m.yields).toEqual([0, 500, 500, 500]);
  expect(m.refreshes()).toBe(3);
  expect(m.resets()).toBe(1);
  expect(stopped).toEqual([Simulator.CLIFF_TERMINATION]);
  const unlimited = machine();
  unlimited.load([0, 0, 0, 0, 0]);
  await unlimited.simulator.simulate(unlimited.program, T, 0, null, null);
  expect(unlimited.yields).toEqual([0, 0, 0]);
  expect(unlimited.resets()).toBe(2);
  const notice = new SimulatorNotice(0, 1, 0.5, T);
  expect(notice.toString()).toBe('START Max Steps 1 Speed 0.5 inst/secProg Ctr 4194304');
  expect(notice.getProgramCounter()).toBe(T);
  expect(notice.getRunSpeed()).toBe(0.5);
  expect(notice.getMaxSteps()).toBe(1);
});

it('lets an input host observe a stop requested before its read starts', async () => {
  let releaseYield!: () => void;
  const m = machine({
    yieldControl: () =>
      new Promise<void>((resolve) => {
        releaseYield = resolve;
      }),
    readInput: () => {
      expect(m.simulator.isStopRequested()).toBe(true);
      return '17';
    }
  });
  m.load([0x0000000c, 0x24080063]);
  m.registers.updateRegister(2, 5);
  const reasons: number[] = [];
  const running = m.simulator.simulate(m.program, T, 0, null, {
    name: 'Go',
    stopped: (_error, reason) => reasons.push(reason)
  });
  m.simulator.stopExecution({ name: 'Stop' });
  releaseYield();
  expect(await running).toBe(false);
  expect(m.registers.getValue(2)).toBe(17);
  expect(m.registers.getValue(8)).toBe(0);
  expect(reasons).toEqual([Simulator.PAUSE_OR_STOP]);
  expect(m.simulator.isStopRequested()).toBe(false);
});

it('replaces the active breakpoints at the next instruction boundary and ignores updates when idle', async () => {
  const yielded: (() => void)[] = [];
  const m = machine({
    yieldControl: () =>
      new Promise<void>((resolve) => {
        yielded.push(resolve);
      })
  });
  const pendingYield = async () => {
    while (yielded.length === 0) await Promise.resolve();
    return yielded.shift()!;
  };
  m.load([0x25080001, 0x25080001, 0x25080001, 0x25080001, 0x25080001, 0x25080001]);
  m.simulator.updateBreakpoints([T + 4]);
  const reasons: number[] = [];
  const action = {
    name: 'Go',
    paused: (_done: boolean, reason: number) => reasons.push(reason),
    stopped: (_error: unknown, reason: number) => reasons.push(reason)
  };
  let running = m.simulator.simulate(m.program, T, 0, [T + 12], action);
  (await pendingYield())();
  const batch = await pendingYield();
  expect(m.registers.getProgramCounter()).toBe(T + 8);
  m.simulator.updateBreakpoints([T + 20, T + 16]);
  batch();
  expect(await running).toBe(false);
  expect(m.registers.getProgramCounter()).toBe(T + 16);
  expect(m.registers.getValue(8)).toBe(4);
  running = m.simulator.simulate(m.program, T + 16, 0, [T + 20], action);
  m.simulator.updateBreakpoints(null);
  (await pendingYield())();
  (await pendingYield())();
  expect(await running).toBe(true);
  expect(m.registers.getValue(8)).toBe(6);
  expect(reasons).toEqual([Simulator.BREAKPOINT, Simulator.CLIFF_TERMINATION]);
});
