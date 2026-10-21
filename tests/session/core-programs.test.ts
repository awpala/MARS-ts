import { readOracleJson } from '../oracle/fixtures.js';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../oracle/cases.json';
import { Globals } from '#lib/engine/Globals.js';
import { Settings } from '#lib/engine/Settings.js';
import { ProcessingException } from '#lib/engine/diagnostics/ProcessingException.js';
import { AccessNotice } from '#lib/engine/hardware/notices/AccessNotice.js';
import { Simulator } from '#lib/engine/simulator/Simulator.js';
import { RunController } from '#lib/venus/RunController.js';

const rootPrefix = resolve('.') + '/';
const normalize = (text: string) => Buffer.from(text.replaceAll(rootPrefix, '<repo>/'), 'utf8');
const deferred: Record<string, string> = {
  'seeded-random': 'random services await the P4 syscall implementation and Java Random parity'
};

/** Read expected machine values from the Java display, without implementing a CLI. */
function capturedState(text: string) {
  const registers: { name: string; word: number; pair: bigint | null }[] = [];
  const memory: { address: number; word: number }[] = [];
  for (const line of text.split('\n')) {
    const register = /^(\$\w+)\t0x([0-9a-f]{8})(?:\t0x([0-9a-f]{16}))?$/.exec(line);
    if (line.startsWith('$') && register === null)
      throw new Error(`Unrecognized register capture: ${line}`);
    if (register !== null)
      registers.push({
        name: register[1],
        word: parseInt(register[2], 16) | 0,
        pair: register[3] === undefined ? null : BigInt('0x' + register[3])
      });
    const words = /^Mem\[0x([0-9a-f]{8})\]\t((?:0x[0-9a-f]{8}\t)+)$/.exec(line);
    if (line.startsWith('Mem[') && words === null)
      throw new Error(`Unrecognized memory capture: ${line}`);
    if (words !== null)
      for (const [index, word] of words[2].split('\t').filter(Boolean).entries())
        memory.push({
          address: (parseInt(words[1], 16) + index * 4) | 0,
          word: parseInt(word.slice(2), 16) | 0
        });
  }
  return { registers, memory };
}
/** Extract only actual engine diagnostics; Java launcher headings/newlines are presentation. */
function capturedDiagnostics(text: string, severity: 'Error' | 'Warning'): Buffer {
  return Buffer.from(
    text
      .split('\n')
      .filter((line) => line.startsWith(severity + ' in '))
      .map((line) => line + '\n')
      .join('')
  );
}

describe('original Java corpus through production Globals and RunController', () => {
  for (const entry of manifest.cases) {
    if (deferred[entry.id]) {
      it.skip(`${entry.id}: ${deferred[entry.id]}`, () => {});
      continue;
    }
    it(
      entry.id,
      async () => {
        const stdout = readFileSync(`tests/oracle/golden/${entry.id}.stdout`);
        const stderr = readFileSync(`tests/oracle/golden/${entry.id}.stderr`);
        const metadata = readOracleJson(`golden/${entry.id}.json`) as { exitCode: number };
        expect(metadata.exitCode).toBe(entry.expectedExitCode);
        const captured = stdout.toString('utf8') + stderr.toString('utf8');
        const expected = capturedState(captured);
        expect(expected.registers).toHaveLength(
          entry.options.filter((option) => option.startsWith('$')).length
        );
        const filename = resolve('tests/oracle/programs', entry.program);
        const files = new Map(
          [entry.program, ...(entry.auxiliaryFiles ?? [])].map((name) => {
            const path = resolve('tests/oracle/programs', name);
            return [path, readFileSync(path, 'utf8')] as const;
          })
        );
        const output: string[] = [],
          platformDiagnostics: string[] = [];
        const input = entry.stdin.match(/[^\n]*\n|[^\n]+$/g) ?? [];
        const machine = new Globals({
          readSource: (path) => {
            const contents = files.get(path);
            if (contents === undefined)
              throw new Error(`Source was not declared in the oracle case: ${path}`);
            return contents;
          },
          sourcePaths: { separator: '/', isAbsolute, getParent: dirname },
          readInput: () => {
            const line = input.shift();
            if (line === undefined) throw new Error('Unexpected console input request');
            return line;
          },
          printString: (text) => output.push(text),
          writeDiagnostic: (text) => platformDiagnostics.push(text),
          yieldControl: async () => {},
          instructionsPerYield: 1000
        });
        const controller = new RunController(machine);
        const settings = machine.getSettings();
        settings.setBooleanSettingNonPersistent(Settings.ASSEMBLE_ALL_ENABLED, false);
        settings.setBooleanSettingNonPersistent(
          Settings.EXTENDED_ASSEMBLER_ENABLED,
          entry.id !== 'pseudo-disabled'
        );
        settings.setBooleanSettingNonPersistent(
          Settings.DELAYED_BRANCHING_ENABLED,
          entry.id === 'branch-delayed'
        );
        settings.setBooleanSettingNonPersistent(Settings.START_AT_MAIN, entry.id === 'main-global');
        settings.setBooleanSettingNonPersistent(Settings.POPUP_SYSCALL_INPUT, false);
        settings.setBooleanSettingNonPersistent(
          Settings.PROGRAM_ARGUMENTS,
          entry.id === 'program-arguments'
        );
        let unsubscribe = () => {};
        try {
          let assemblyError: ProcessingException | null = null;
          try {
            controller.assemble([filename], filename);
          } catch (error) {
            if (!(error instanceof ProcessingException)) throw error;
            assemblyError = error;
          }
          if (metadata.exitCode === 2) {
            expect(assemblyError).not.toBeNull();
            expect(controller.getState().status).toBe('error');
            expect(normalize(assemblyError!.errors()!.generateErrorReport())).toEqual(
              capturedDiagnostics(captured, 'Error')
            );
          } else {
            expect(assemblyError).toBeNull();
            expect(
              normalize(controller.getState().diagnostics?.generateWarningReport() ?? '')
            ).toEqual(capturedDiagnostics(captured, 'Warning'));
            let instructionCount = 0,
              lastAddress = 0;
            unsubscribe = machine.memory.addObserver(
              (notice) => {
                if (
                  !notice.accessIsFromMIPS() ||
                  notice.getAccessType() !== AccessNotice.READ ||
                  notice.getAddress() === lastAddress
                )
                  return;
                lastAddress = notice.getAddress();
                instructionCount++;
              },
              machine.memory.textBaseAddress,
              machine.memory.textLimitAddress
            );
            await controller.run(
              [],
              entry.id === 'step-limit' ? 100 : -1,
              entry.arguments.join(' ')
            );
            unsubscribe();
            const state = controller.getState();
            if (metadata.exitCode === 3) {
              expect(state.status).toBe('error');
              expect(state.error).not.toBeNull();
              expect(normalize(state.error!.errors()!.generateErrorReport())).toEqual(
                capturedDiagnostics(captured, 'Error')
              );
            } else {
              expect(state.error).toBeNull();
              // Exit2 intentionally follows the GUI contract: normal completion. The
              // Java launcher's process exit code 7 is not a browser behavior to port.
              if (entry.id === 'step-limit') expect(state.reason).toBe(Simulator.MAX_STEPS);
              else expect(state.status).toBe('terminated');
            }
            if (entry.options.includes('ic')) {
              const count = /^([0-9]+)$/m.exec(captured);
              expect(count).not.toBeNull();
              expect(instructionCount).toBe(Number(count![1]));
            }
            for (const register of expected.registers) {
              if (register.name.startsWith('$f')) {
                const number = Number(register.name.slice(2));
                expect(
                  machine.coprocessor1.getRegisters()[number].getValueNoNotify(),
                  register.name
                ).toBe(register.word);
                if (register.pair !== null)
                  expect(
                    BigInt.asUintN(64, machine.coprocessor1.getLongFromRegisterPair(number)),
                    register.name + ' pair'
                  ).toBe(register.pair);
              } else
                expect(
                  machine.registerFile.getUserRegister(register.name)!.getValueNoNotify(),
                  register.name
                ).toBe(register.word);
            }
            for (const word of expected.memory)
              expect(
                machine.memory.getRawWordOrNull(word.address) ?? 0,
                `memory ${word.address.toString(16)}`
              ).toBe(word.word);
          }
          // The 'me' captures already separate raw program bytes from the launcher.
          // The other enabled fixtures print no console text; their stdout contains
          // only the captured diagnostics/register/memory/instruction-count display.
          expect(normalize(output.join(''))).toEqual(
            entry.options.includes('me') ? stdout : Buffer.alloc(0)
          );
          expect(platformDiagnostics).toEqual([]);
          expect(input).toEqual([]);
        } finally {
          unsubscribe();
          await controller.dispose();
        }
      },
      15000
    );
  }
});
