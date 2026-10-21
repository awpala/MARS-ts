import { describe, expect, it } from 'vitest';
import { readOracleJson } from '../oracle/fixtures.js';
import { Globals } from '#lib/engine/Globals.js';
import { Settings } from '#lib/engine/Settings.js';
import { ProgramArgumentList } from '#lib/engine/simulator/ProgramArgumentList.js';
import { RunController } from '#lib/venus/RunController.js';

function machine(source = '.text\naddiu $a0,$a0,1\nnop\nli $v0,10\nsyscall\n') {
  return new Globals({
    readSource: () => source,
    sourcePaths: {
      separator: '/',
      isAbsolute: (name) => name.startsWith('/'),
      getParent: () => null
    },
    readInput: () => '',
    printString: () => {},
    yieldControl: async () => {}
  });
}

interface Observation {
  id: string;
  configuration: string;
  input: string;
  registers: number[];
  stack: number[];
  strings: number[][];
}
const capture = readOracleJson('program-arguments-units/golden.json') as { stdout: string };
const observations: Observation[] = capture.stdout
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));

describe('ProgramArgumentList Java oracle', () => {
  for (const row of observations) {
    it(row.id, () => {
      const session = machine();
      session.memoryConfigurations.setCurrentConfiguration(
        session.memoryConfigurations.getConfigurationByName(row.configuration)
      );
      session.registerFile.getUserRegister('$a0')!.setValue(91);
      session.registerFile.getUserRegister('$a1')!.setValue(92);
      session.registerFile.getUserRegister('$sp')!.setValue(session.memory.stackPointer - 64);
      new ProgramArgumentList(
        Buffer.from(row.input, 'base64').toString('utf8')
      ).storeProgramArguments(session.memory, session.registerFile);
      expect([29, 4, 5].map((id) => session.registerFile.getValue(id))).toEqual(row.registers);
      expect(row.stack.map((_, i) => session.memory.getWord(row.registers[0] + i * 4))).toEqual(
        row.stack
      );
      expect(
        row.strings.map((bytes, i) => {
          const address = session.memory.getWord(row.registers[2] + i * 4);
          return bytes.map((_, j) => session.memory.getByte(address + j) & 255);
        })
      ).toEqual(row.strings);
      session.dispose();
    });
  }
});

it('reports the legacy memory-write diagnostic without exiting the host', () => {
  const session = machine();
  session.memoryConfigurations.setCurrentConfiguration(
    session.memoryConfigurations.getConfigurationByName('CompactDataAtZero')
  );
  const failure = readOracleJson('program-arguments-units/failure.json') as {
    stdout: string;
    status: number;
  };
  expect(failure.status).toBe(0);
  expect(() =>
    new ProgramArgumentList('x'.repeat(16384)).storeProgramArguments(
      session.memory,
      session.registerFile
    )
  ).toThrow(failure.stdout.trim());
  session.dispose();
});

describe('Venus first-execution argument lifecycle', () => {
  it('initializes on Step once, preserves args through undo and checkpoint restore, and reapplies only after Reset', async () => {
    const session = machine();
    const controller = new RunController(session);
    session.getSettings().setBooleanSetting(Settings.PROGRAM_ARGUMENTS, true);
    controller.assemble(['main.asm'], 'main.asm');
    expect(session.program!.getBackStepper()!.empty()).toBe(true);
    await controller.step('one two');
    expect(session.registerFile.getValue(4)).toBe(3);
    controller.backStep();
    expect(session.registerFile.getValue(4)).toBe(2);
    expect(session.program!.getBackStepper()!.empty()).toBe(true);
    const checkpoint = controller.captureCheckpoint()!;
    const restored = machine();
    const recovered = new RunController(restored);
    recovered.restoreCheckpoint(checkpoint);
    await recovered.step('different');
    expect(restored.registerFile.getValue(4)).toBe(3);
    recovered.reset();
    await recovered.step('different');
    expect(restored.registerFile.getValue(4)).toBe(2);
    await controller.dispose();
    await recovered.dispose();
  });

  it('applies Go arguments once across pauses, retains literal quotes, and respects the disabled setting', async () => {
    const session = machine();
    const controller = new RunController(session);
    controller.assemble(['main.asm'], 'main.asm');
    await controller.run([], 1, 'one two');
    expect(session.registerFile.getValue(4)).toBe(1);
    session.getSettings().setBooleanSetting(Settings.PROGRAM_ARGUMENTS, true);
    await controller.run([], 1, 'one two');
    expect(session.registerFile.getValue(4)).toBe(1);
    controller.reset();
    await controller.run([], 1, '"one two" three');
    expect(session.registerFile.getValue(4)).toBe(4);
    const first = session.memory.getWord(session.registerFile.getValue(5));
    expect(session.memory.getByte(first)).toBe('"'.charCodeAt(0));
    await controller.dispose();
  });
});
