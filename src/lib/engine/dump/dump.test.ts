import { describe, expect, it } from 'vitest';
import { Globals } from '../Globals.js';
import { Settings } from '../Settings.js';
import { RunController } from '#lib/venus/RunController.js';
import { DumpFormatLoader } from './DumpFormatLoader.js';
import { MemoryDump } from './MemoryDump.js';
import { readOracleJson, parseTabRows } from '../../../../tests/oracle/fixtures.js';

const source = '.text\nmain: li $t0, 0x12345678 # source é\naddiu $t1, $t0, -1\nsyscall\n';
const words = [0, -1, 0x7fffffff, -2147483648, 0x12345678, 0x00410a09, 0x0d0c085c, 0x20217f80, 42];

function session(configuration: string) {
  const machine = new Globals({
    readSource: () => source,
    sourcePaths: { separator: '/', isAbsolute: () => false, getParent: () => null },
    readInput: () => '',
    printString: () => {},
    yieldControl: async () => {}
  });
  machine.memoryConfigurations.setCurrentConfiguration(
    machine.memoryConfigurations.getConfigurationByName(configuration)!
  );
  const controller = new RunController(machine);
  controller.assemble(['dump.asm'], 'dump.asm');
  words.forEach((word, i) =>
    machine.memory.setRawWord(machine.memory.dataBaseAddress + i * 4, word)
  );
  return { machine, controller };
}

describe('memory dump Java oracle', () => {
  it('matches all format bytes, ranges, display bases, sparse stops, partial rows, and address failures', async () => {
    const fixture = readOracleJson<{ stdout: string; stderr: string; status: number }>(
      'dump-units/golden.json'
    );
    expect(fixture.stderr).toBe('');
    expect(fixture.status).toBe(0);
    const rows = parseTabRows(fixture.stdout);
    const machines = new Map<string, ReturnType<typeof session>>();
    try {
      for (const row of rows) {
        const [configuration, id] = row;
        if (!machines.has(configuration)) machines.set(configuration, session(configuration));
        const { machine } = machines.get(configuration)!;
        if (id === 'ranges') {
          expect(
            new MemoryDump(machine)
              .getSegments()
              .flatMap((segment) => [segment.firstAddress, segment.lastAddress])
          ).toEqual(row.slice(2).map(Number));
          continue;
        }
        const [, , descriptor, first, last, encoded, error] = row;
        if (id.startsWith('data-') || id.startsWith('text-')) {
          const [, addresses, values] = id.split('-');
          machine
            .getSettings()
            .setBooleanSettingNonPersistent(
              Settings.DISPLAY_ADDRESSES_IN_HEX,
              addresses === 'true'
            );
          machine
            .getSettings()
            .setBooleanSettingNonPersistent(Settings.DISPLAY_VALUES_IN_HEX, values === 'true');
        }
        if (id === 'big-endian') {
          machine.memory.setByteOrder(false);
          machine.memory.setWord(machine.memory.dataBaseAddress, 0x12345678);
        }
        const format = new DumpFormatLoader()
          .loadDumpFormats(machine)
          .find((item) => item.descriptor === descriptor)!;
        if (error) {
          expect(
            () => format.dumpMemoryRange(Number(first), Number(last)),
            `${configuration}/${id}/${descriptor}`
          ).toThrow(error);
        } else {
          expect(
            Buffer.from(format.dumpMemoryRange(Number(first), Number(last))).toString('base64'),
            `${configuration}/${id}/${descriptor}`
          ).toBe(encoded);
        }
      }
    } finally {
      await Promise.all([...machines.values()].map(({ controller }) => controller.dispose()));
    }
  });

  it('keeps range allocation and formats isolated between machines and omits empty segments', async () => {
    const first = session('Default');
    const second = session('CompactDataAtZero');
    try {
      first.machine.memory.clear();
      expect(new MemoryDump(first.machine).getSegments()).toEqual([]);
      expect(new MemoryDump(second.machine).getSegments().map((segment) => segment.name)).toEqual([
        '.text',
        '.data'
      ]);
      expect(new DumpFormatLoader().loadDumpFormats(first.machine)).toHaveLength(6);
    } finally {
      await first.controller.dispose();
      await second.controller.dispose();
    }
  });
});
