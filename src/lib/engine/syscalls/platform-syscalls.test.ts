import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { Globals, type GlobalsHost } from '../Globals.js';
import { ProgramStatement } from '../assembler/programs/ProgramStatement.js';
import { TokenList } from '../assembler/tokenization/TokenList.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';
import { RandomStreams, isRandomStreamsState } from './random/RandomStreams.js';
import { RunController } from '#lib/venus/RunController.js';
import { isRunCheckpoint } from '#lib/venus/RunCheckpoint.js';

const DATA = 0x10010000;
const decode = (text: string) => Buffer.from(text, 'base64').toString('utf8');
function machine(overrides: Partial<GlobalsHost> = {}) {
  return new Globals({
    readSource: () => '.text\nnop\nli $v0,10\nsyscall\n',
    sourcePaths: {
      separator: '/',
      isAbsolute: (name) => name.startsWith('/'),
      getParent: () => ''
    },
    readInput: () => '',
    printString: () => {},
    yieldControl: async () => {},
    ...overrides
  });
}

for (const group of ['random', 'dialogs'])
  describe(`${group} canonical syscall captures`, () => {
    const fixture = JSON.parse(
      readFileSync(`tests/oracle/platform-syscalls/${group}.json`, 'utf8')
    ) as { stdout: string };
    const rows = fixture.stdout
      .trimEnd()
      .split('\n')
      .map((row) => row.split('\t'));
    let input: string | null = null,
      action = 0,
      message = '',
      type = -99;
    const local = machine({
      dialogs: {
        showConfirmDialog: (text) => {
          message = text;
          type = 3;
          return action;
        },
        showInputDialog: (text) => {
          message = text;
          type = 3;
          return input;
        },
        showMessageDialog: (text, messageType) => {
          message = text;
          type = messageType;
        }
      }
    });
    const statement = new ProgramStatement(
      null,
      '',
      new TokenList(),
      new TokenList(),
      local.instructionSet.matchOperator('syscall')![0],
      0x00400000,
      0,
      {
        registerFile: local.registerFile,
        coprocessor1: local.coprocessor1,
        findByBinaryCode: (word) => local.instructionSet.findByBinaryCode(word),
        matchOperator: (name) => local.instructionSet.matchOperator(name),
        getDisplayAddressesInHex: () => true,
        getDisplayValuesInHex: () => true
      }
    );
    // Rows execute in capture order so independent random streams retain their sequence across calls.
    it(`matches every raw register, memory byte, message, type, and diagnostic (${rows.length} cases)`, async () => {
      try {
        for (const row of rows) {
          const [service, n, a0, a1, a2, f12, f13] = row.slice(0, 7).map(Number);
          input = row[7] === 'null' ? null : decode(row[7]);
          action = Number(row[8]);
          message = '';
          type = -99;
          const r = local.registerFile,
            cp = local.coprocessor1;
          r.resetRegisters();
          local.coprocessor0.resetRegisters();
          cp.resetRegisters();
          r.setProgramCounter(0x00400004);
          r.updateRegister(2, service);
          r.updateRegister(4, a0);
          r.updateRegister(5, a1);
          r.updateRegister(6, a2);
          cp.updateRegister(0, 0x12345678);
          cp.updateRegister(1, 0x76543210);
          cp.updateRegister(12, f12);
          cp.updateRegister(13, f13);
          for (let i = -8; i < 32; i++) local.memory.setByte(DATA + 64 + i, 0x7e);
          local.memory.setByte(0x103fffff, 0x7e);
          [65, 127, 128, 255, 0].forEach((byte, i) => local.memory.setByte(DATA + i, byte));
          [66, 255, 0].forEach((byte, i) => local.memory.setByte(DATA + 32 + i, byte));
          let outcome = 'ok';
          try {
            await local.syscallLoader.findSyscall(service)!.simulate(statement);
          } catch (error) {
            if (!(error instanceof ProcessingException)) throw error;
            outcome = error.errors()?.generateErrorReport() ?? 'exit';
          }
          const label = `${service} case ${n}`;
          expect(outcome, label).toBe(decode(row[9]));
          expect(message, label).toBe(decode(row[10]));
          expect(type, label).toBe(Number(row[11]));
          const state = [
            ...[2, 4, 5, 6].map((i) => r.getValue(i)),
            ...[0, 1].map((i) => cp.getValue(i)),
            ...[8, 12, 13, 14].map((i) => local.coprocessor0.getValue(i)),
            ...Array.from({ length: 40 }, (_, i) => local.memory.getByte(DATA + 56 + i))
          ];
          state.push(local.memory.getByte(0x103fffff));
          expect(state.join(','), label).toBe(row[12]);
        }
      } finally {
        local.dispose();
      }
    });
  });

describe('random ownership and recovery', () => {
  it('uses entropy only once per unseeded stream and isolates signed stream IDs and sessions', () => {
    const entropy = vi.fn(() => 123456789n);
    const a = new RandomStreams(entropy),
      b = new RandomStreams(() => 123456789n);
    expect(a.get(-1).nextInt()).toBe(b.get(-1).nextInt());
    a.get(-1).nextFloat();
    expect(entropy).toHaveBeenCalledTimes(1);
    a.setSeed(0, -1);
    a.setSeed(0, 0);
    expect(entropy).toHaveBeenCalledTimes(1);
    a.get(-2147483648).nextDouble();
    expect(entropy).toHaveBeenCalledTimes(2);
    expect(a.captureState()).not.toEqual(b.captureState());
  });
  it('continues every stream after JSON checkpoint recovery and retains streams through Reset', () => {
    const local = machine(),
      restored = machine();
    const controls = new RunController(local),
      other = new RunController(restored);
    try {
      controls.assemble(['main.asm'], 'main.asm');
      local.randomStreams.setSeed(-7, -2147483648);
      local.randomStreams.get(-7).nextDouble();
      local.randomStreams.setSeed(42, 123);
      local.randomStreams.get(42).nextFloat();
      const checkpoint = JSON.parse(JSON.stringify(controls.captureCheckpoint()));
      expect(isRunCheckpoint(checkpoint)).toBe(true);
      other.restoreCheckpoint(checkpoint);
      expect(restored.randomStreams.get(-7).nextDouble()).toBe(
        local.randomStreams.get(-7).nextDouble()
      );
      expect(restored.randomStreams.get(42).nextInt(1073741825)).toBe(
        local.randomStreams.get(42).nextInt(1073741825)
      );
      const state = local.randomStreams.captureState();
      controls.reset();
      expect(local.randomStreams.captureState()).toEqual(state);
      for (const invalid of [
        [[0, -1]],
        [[0, 2 ** 48]],
        [
          [0, 1],
          [0, 2]
        ],
        [[0.5, 1]],
        [[0, NaN]]
      ]) {
        expect(isRandomStreamsState(invalid)).toBe(false);
        expect(isRunCheckpoint({ ...checkpoint, randomStreams: invalid })).toBe(false);
      }
    } finally {
      void controls.dispose();
      void other.dispose();
    }
  });
  it('preserves pending dialog host errors and waits before writing result registers', async () => {
    let resolve: (text: string | null) => void = () => {};
    const local = machine({
      dialogs: {
        showInputDialog: () =>
          new Promise((r) => {
            resolve = r;
          }),
        showConfirmDialog: () => 0,
        showMessageDialog: () => {}
      }
    });
    try {
      local.memory.setByte(DATA, 0);
      local.registerFile.updateRegister(4, DATA);
      local.registerFile.updateRegister(5, 99);
      const statement = local.memory.decodeCheckpointStatement(12, 0x00400000);
      const pending = local.syscallLoader.findSyscall(51)!.simulate(statement);
      expect(local.registerFile.getValue(5)).toBe(99);
      resolve(' 42 ');
      await pending;
      expect(local.registerFile.getValue(4)).toBe(0);
      expect(local.registerFile.getValue(5)).toBe(-1);
    } finally {
      local.dispose();
    }
    const failure = new Error('host failure');
    const broken = machine({
      dialogs: {
        showInputDialog: () => Promise.reject(failure),
        showConfirmDialog: () => 0,
        showMessageDialog: () => {}
      }
    });
    try {
      broken.memory.setByte(DATA, 0);
      broken.registerFile.updateRegister(4, DATA);
      broken.registerFile.updateRegister(5, 99);
      await expect(
        broken.syscallLoader
          .findSyscall(51)!
          .simulate(broken.memory.decodeCheckpointStatement(12, 0x00400000))
      ).rejects.toBe(failure);
      expect(broken.registerFile.getValue(5)).toBe(99);
    } finally {
      broken.dispose();
    }
  });
});
