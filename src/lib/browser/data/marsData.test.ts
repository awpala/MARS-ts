import { describe, expect, it } from 'vitest';
import { Globals } from '#lib/engine/Globals.js';
import { Settings } from '#lib/engine/Settings.js';
import { RunController } from '#lib/venus/RunController.js';
import {
  DEFAULT_DISPLAY_SETTINGS,
  DISPLAY_SETTINGS_STORAGE_KEY,
  saveDisplaySettings
} from '../preferences/DisplaySettings.js';
import {
  browserEnginePreferences,
  ENGINE_SETTINGS_STORAGE_PREFIX
} from '../preferences/EnginePreferences.js';
import { PANE_LAYOUT_STORAGE_KEY, savePaneLayout } from '../preferences/PaneLayout.js';
import { saveTheme, THEME_STORAGE_KEY } from '../preferences/ThemePreference.js';
import {
  DESKTOP_SESSION_STORAGE_KEY,
  MAIN_VIEWS,
  MEMORY_SEGMENTS,
  MESSAGE_TABS,
  REGISTER_BANKS,
  type DesktopSession
} from '../session/DesktopSession.js';
import { DesktopSessionWriter } from '../session/DesktopSessionWriter.js';
import {
  SOURCE_LIBRARY_STORAGE_KEY,
  SOURCE_WORKSPACE_STORAGE_KEY,
  SourceLibrary
} from '../sources/SourceLibrary.js';
import { unsupportedSchemaKeywords } from './jsonSchema.js';
import {
  applyMarsData,
  captureMarsData,
  MARS_DATA_FILENAME,
  MARS_DATA_MAX_BYTES,
  MARS_DATA_SCHEMA,
  MARS_DATA_STORAGE_KEYS,
  marsDataBlob,
  readMarsData,
  readMarsDataFile,
  summarizeMarsData,
  validateMarsData,
  type MarsData
} from './marsData.js';

const SOURCE = '.data\nvalue: .word 7\n.text\nlw $t0, value\naddi $t0, $t0, 1\n';

/** Map-backed stand-in for localStorage; `fail` makes writes of one key throw, as a full quota would. */
function memoryStorage(initial: Record<string, string> = {}, fail?: string) {
  const values = new Map(Object.entries(initial));
  const store = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === fail) throw new Error('Quota exceeded');
      values.set(key, value);
    },
    removeItem: (key: string) => void values.delete(key)
  };
  return { values, access: () => store };
}

/** Fill storage through the application's own writers, including a stepped program's recovery record. */
async function populatedStorage() {
  const storage = memoryStorage();
  const library = new SourceLibrary(storage.access);
  library.saveMany([
    { name: 'main.asm', source: SOURCE },
    { name: 'lib/util.s', source: '# util\n' }
  ]);
  library.saveWorkspace([
    { name: 'main.asm', source: SOURCE, savedSource: SOURCE, isNew: false, selected: false },
    { name: 'mips1.asm', source: '# draft\n', savedSource: '', isNew: true, selected: true },
    { name: '/SPIM:/exceptions.s', source: '', savedSource: '', isNew: false, selected: false }
  ]);
  saveDisplaySettings({ ...DEFAULT_DISPLAY_SETTINGS, speed: 12, ascii: true }, storage.access);
  savePaneLayout(
    { registerWidth: 300.4, editorFraction: 0.6, dataSegmentHeight: null },
    storage.access
  );
  saveTheme('dark', storage.access);
  const settings = new Settings(browserEnginePreferences(storage.access));
  settings.setBooleanSetting(Settings.DELAYED_BRANCHING_ENABLED, true);
  settings.setBooleanSetting(Settings.EXTENDED_ASSEMBLER_ENABLED, false);

  const machine = new Globals({
    readSource: () => SOURCE,
    readInput: () => '',
    printString: () => {},
    yieldControl: async () => {},
    sourcePaths: {
      separator: '/',
      isAbsolute: (filename) => filename.startsWith('/'),
      getParent: () => ''
    }
  });
  const controller = new RunController(machine);
  let session: DesktopSession;
  try {
    controller.assemble(['main.asm'], 'main.asm');
    await controller.step();
    await controller.step();
    session = {
      programArguments: 'one two',
      view: 'Execute',
      registerTab: 'Coproc 1',
      messageTab: 'Run I/O',
      help: { open: false, tab: 'mars', articles: { mars: 'help-debugging' } },
      source: 'main.asm',
      editHistory: [
        {
          name: 'mips1.asm',
          text: '# draft\n',
          undo: ['', { text: '#', before: [1, 1], after: [8, 8] }],
          redo: []
        }
      ],
      dataView: { segment: 'sp', pageOffset: -128 },
      selection: [3, 9],
      scroll: [40, 0],
      breakpoints: [0x00400004, -2147483648],
      breakpointsEnabled: false,
      messages: 'Assemble: operation completed successfully.\n',
      runIO: '',
      execution: {
        machine: controller.captureCheckpoint()!,
        sources: { 'main.asm': SOURCE },
        labelSelection: { filename: 'main.asm', name: 'value', address: 0x10010000 }
      },
      unloadedError: false
    };
  } finally {
    await controller.dispose();
  }
  let failure: unknown;
  const writer = new DesktopSessionWriter((error) => (failure = error), storage.access);
  writer.schedule(session);
  writer.dispose();
  expect(failure).toBeUndefined();
  return storage;
}

/** A deep copy of a payload with one edit applied, for rejection cases. */
function altered(data: MarsData, edit: (copy: Record<string, never>) => void): unknown {
  const copy = structuredClone(data) as unknown as Record<string, never>;
  edit(copy);
  return copy;
}

describe('MARS data schema', () => {
  it('uses only keywords the validator evaluates', () => {
    expect(unsupportedSchemaKeywords(MARS_DATA_SCHEMA)).toEqual([]);
  });

  it('mirrors exactly the storage keys the application owns', () => {
    const engineKeys: string[] = [];
    new Settings({
      readPreference: (key) => {
        engineKeys.push(ENGINE_SETTINGS_STORAGE_PREFIX + key);
        return null;
      }
    });
    expect(engineKeys).toHaveLength(Settings.BOOLEAN_COUNT + Settings.STRING_COUNT);
    expect([...MARS_DATA_STORAGE_KEYS].sort()).toEqual(
      [
        SOURCE_LIBRARY_STORAGE_KEY,
        SOURCE_WORKSPACE_STORAGE_KEY,
        DISPLAY_SETTINGS_STORAGE_KEY,
        PANE_LAYOUT_STORAGE_KEY,
        THEME_STORAGE_KEY,
        DESKTOP_SESSION_STORAGE_KEY,
        ...engineKeys
      ].sort()
    );
    const records = MARS_DATA_SCHEMA.properties!.storage.properties!;
    const kind = (key: string) => records[ENGINE_SETTINGS_STORAGE_PREFIX + key].$ref;
    expect(kind('DelayedBranching')).toBe('#/$defs/booleanPreference');
    expect(kind('MemoryConfiguration')).toBe('#/$defs/stringPreference');
  });

  it('shares the stored vocabularies, field sets, and array sizes of the record owners', () => {
    const defs = MARS_DATA_SCHEMA.$defs!;
    const display = defs.displaySettings;
    expect(Object.keys(display.properties!).sort()).toEqual(
      Object.keys(DEFAULT_DISPLAY_SETTINGS).sort()
    );
    expect(display.required).toEqual([
      'showLabels',
      'showLines',
      'hexValues',
      'hexAddresses',
      'speed'
    ]);
    const session = defs.desktopSession.properties!;
    expect(session.view.enum).toEqual([...MAIN_VIEWS]);
    expect(session.registerTab.enum).toEqual([...REGISTER_BANKS]);
    expect(session.messageTab.enum).toEqual([...MESSAGE_TABS]);
    expect(session.dataView.properties!.segment.enum).toEqual([...MEMORY_SEGMENTS]);
    const settings = defs.runCheckpoint.properties!.settings.properties!;
    expect(settings.booleans.minItems).toBe(Settings.BOOLEAN_COUNT);
    expect(settings.booleans.maxItems).toBe(Settings.BOOLEAN_COUNT);
    expect(settings.strings.minItems).toBe(Settings.STRING_COUNT);
    expect(settings.strings.maxItems).toBe(Settings.STRING_COUNT);
  });
});

describe('MARS data capture and validation', () => {
  it('captures every record the application writers store as a payload that conforms to the schema', async () => {
    const storage = await populatedStorage();
    const data = captureMarsData(storage.access, new Date('2026-11-16T12:34:56.789Z'));
    expect(validateMarsData(data)).toEqual([]);
    expect(data.$schema).toBe(MARS_DATA_SCHEMA.$id);
    expect(data.format).toBe('mars-ts-data');
    expect(data.version).toBe(1);
    expect(data.exportedAt).toBe('2026-11-16T12:34:56.789Z');
    expect(Object.keys(data.storage).sort()).toEqual([...storage.values.keys()].sort());
    expect(data.storage[SOURCE_LIBRARY_STORAGE_KEY]).toEqual([
      { name: 'main.asm', source: SOURCE },
      { name: 'lib/util.s', source: '# util\n' }
    ]);
    expect(data.storage[THEME_STORAGE_KEY]).toBe('dark');
    expect(data.storage[`${ENGINE_SETTINGS_STORAGE_PREFIX}DelayedBranching`]).toBe('true');
    expect(data.storage[`${ENGINE_SETTINGS_STORAGE_PREFIX}ExtendedAssembler`]).toBe('false');
    const machine = data.storage[DESKTOP_SESSION_STORAGE_KEY]!.execution!.machine;
    expect(machine.history.records.length).toBeGreaterThan(0);
    expect(machine.memory.words[0]).toHaveLength(1);
    expect(summarizeMarsData(data)).toEqual({
      savedSources: 2,
      openBuffers: 3,
      unsavedBuffers: 1,
      settings: 5,
      session: true,
      loadedProgram: 'main.asm',
      exportedAt: '2026-11-16T12:34:56.789Z'
    });
  });

  it('captures only mirrored keys, omits absent ones, and reports a stored record that is not JSON', () => {
    const storage = memoryStorage({
      [THEME_STORAGE_KEY]: 'light',
      'mars-ts:engine-settings:v1:Retired': 'true',
      'another-app:key': '{}'
    });
    const data = captureMarsData(storage.access);
    expect(data.storage).toEqual({ [THEME_STORAGE_KEY]: 'light' });
    expect(validateMarsData(data)).toEqual([]);
    expect(summarizeMarsData(data)).toMatchObject({
      savedSources: 0,
      openBuffers: 0,
      settings: 1,
      session: false,
      loadedProgram: null
    });
    const corrupt = memoryStorage({ [SOURCE_LIBRARY_STORAGE_KEY]: '[' });
    expect(() => captureMarsData(corrupt.access)).toThrow(
      'The stored mars-ts:sources:v1 record is not valid JSON.'
    );
  });

  it('accepts the original display-settings and pane-layout records that older versions stored', () => {
    const data: MarsData = {
      format: 'mars-ts-data',
      version: 1,
      storage: {
        [DISPLAY_SETTINGS_STORAGE_KEY]: {
          showLabels: false,
          showLines: false,
          hexValues: false,
          hexAddresses: false,
          speed: 0
        },
        [PANE_LAYOUT_STORAGE_KEY]: { registerWidth: 300, editorFraction: 0.5 }
      }
    };
    expect(validateMarsData(data)).toEqual([]);
  });

  it('rejects documents that are not this payload, with the path of each problem', () => {
    expect(validateMarsData([])).toEqual(['The document must be an object.']);
    expect(validateMarsData({ format: 'other', version: 2 })).toEqual([
      'The document must have property "storage".',
      '/format must be "mars-ts-data".',
      '/version must be 1.'
    ]);
    expect(
      validateMarsData({
        format: 'mars-ts-data',
        version: 1,
        exportedAt: 'yesterday',
        note: 'x',
        storage: {
          'mars-ts:unknown:v1': 1,
          [THEME_STORAGE_KEY]: 'sepia',
          [`${ENGINE_SETTINGS_STORAGE_PREFIX}BareMachine`]: true,
          [DISPLAY_SETTINGS_STORAGE_KEY]: { ...DEFAULT_DISPLAY_SETTINGS, speed: 41, zoom: 2 },
          [SOURCE_LIBRARY_STORAGE_KEY]: [{ name: 'a.asm' }]
        }
      })
    ).toEqual([
      '/exportedAt must match ^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$.',
      'The document must not have property "note".',
      '/storage must not have property "mars-ts:unknown:v1".',
      '/storage/mars-ts:theme:v1 must be one of "light", "dark".',
      '/storage/mars-ts:engine-settings:v1:BareMachine must be a string.',
      '/storage/mars-ts:display-settings:v1/speed must be at most 40.',
      '/storage/mars-ts:display-settings:v1 must not have property "zoom".',
      '/storage/mars-ts:sources:v1/0 must have property "source".'
    ]);
  });

  it('rejects recovery records and machine state outside the stored shapes', async () => {
    const data = captureMarsData((await populatedStorage()).access);
    const session = (copy: Record<string, never>) =>
      (copy.storage as Record<string, never>)[DESKTOP_SESSION_STORAGE_KEY] as Record<string, never>;
    const machine = (copy: Record<string, never>) =>
      (session(copy).execution as Record<string, never>).machine as Record<string, never>;
    const cases: [(copy: Record<string, never>) => void, string][] = [
      [(copy) => ((session(copy).view as string) = 'Tools'), '/view must be one of'],
      [(copy) => ((session(copy).selection as number[]) = [1]), '/selection must have at least 2'],
      [
        (copy) => ((session(copy).dataView as { pageOffset: number }).pageOffset = 2),
        '/dataView/pageOffset must be a multiple of 4'
      ],
      [(copy) => ((machine(copy).status as string) = 'running'), '/machine/status must be one of'],
      [(copy) => (machine(copy).registers as number[]).pop(), '/registers must have at least 35'],
      [
        (copy) => ((machine(copy).registers as number[])[2] = 2 ** 31),
        '/registers/2 must be at most 2147483647'
      ],
      [
        (copy) => ((machine(copy).conditionFlags as number) = 256),
        '/conditionFlags must be at most 255'
      ],
      [
        (copy) =>
          ((machine(copy).memory as { words: [number, number[]][][] }).words[0][0][1].length = 8),
        '/memory/words/0/0/1 must have at least 1024 items'
      ],
      [
        (copy) => ((machine(copy).memory as { words: unknown[][][] }).words[3] = [[16, []]]),
        '/memory/words/3/0/0 must be at most 15'
      ],
      [(copy) => ((machine(copy).booted as boolean) = true), 'must not have property "booted"']
    ];
    for (const [edit, expected] of cases) {
      const issues = validateMarsData(altered(data, edit));
      expect(issues.join('\n'), expected).toContain(expected);
    }
  });

  it('applies the record owners rules that the schema cannot express', async () => {
    const data = captureMarsData((await populatedStorage()).access);
    const storage = (copy: Record<string, never>) => copy.storage as Record<string, never>;
    expect(
      validateMarsData(
        altered(data, (copy) =>
          (storage(copy)[SOURCE_LIBRARY_STORAGE_KEY] as unknown[]).push({
            name: './main.asm',
            source: ''
          })
        )
      )
    ).toEqual([
      '/storage/mars-ts:sources:v1: The saved source library contains duplicate name "main.asm".'
    ]);
    expect(
      validateMarsData(
        altered(
          data,
          (copy) =>
            ((storage(copy)[SOURCE_WORKSPACE_STORAGE_KEY] as { name: string }[])[1].name =
              '../escape.asm')
        )
      )
    ).toEqual(['/storage/mars-ts:workspace:v1: Source filenames must stay within the library.']);
    expect(
      validateMarsData(
        altered(data, (copy) => {
          const session = storage(copy)[DESKTOP_SESSION_STORAGE_KEY] as {
            execution: { sources: Record<string, string> };
          };
          session.execution.sources = { 'other.asm': '' };
        })
      )
    ).toEqual(['/storage/mars-ts:desktop-session:v1 is not a record MARS can load.']);
  });
});

describe('MARS data files', () => {
  it('writes compact JSON that reads back as the same conforming payload', async () => {
    const data = captureMarsData((await populatedStorage()).access);
    const blob = marsDataBlob(data);
    expect(blob.type).toBe('application/json');
    const text = await blob.text();
    expect(text.endsWith('}\n')).toBe(true);
    const reading = readMarsData(MARS_DATA_FILENAME, text);
    expect(reading.issues).toBeUndefined();
    expect(reading.filename).toBe('mars-ts-data.json');
    expect(reading.data).toEqual(data);
    expect(reading.summary).toEqual(summarizeMarsData(data));
  });

  it('returns malformed, nonconforming, and oversized files as issues instead of throwing', async () => {
    expect(readMarsData('broken.json', '{').issues![0]).toMatch(/^The file is not valid JSON: /);
    expect(readMarsData('other.json', '{"a":1}')).toEqual({
      filename: 'other.json',
      issues: [
        'The document must have property "format".',
        'The document must have property "version".',
        'The document must have property "storage".',
        'The document must not have property "a".'
      ]
    });
    const huge = { name: 'huge.json', size: MARS_DATA_MAX_BYTES + 1, text: async () => '{}' };
    expect(await readMarsDataFile(huge as unknown as File)).toEqual({
      filename: 'huge.json',
      issues: ['The file is larger than 32 MiB.']
    });
    const unreadable = {
      name: 'gone.json',
      size: 2,
      text: async () => {
        throw new Error('NotReadableError');
      }
    };
    expect(await readMarsDataFile(unreadable as unknown as File)).toEqual({
      filename: 'gone.json',
      issues: ['The file could not be read: NotReadableError']
    });
    const file = new File(['{"format":"mars-ts-data","version":1,"storage":{}}'], 'empty.json');
    expect((await readMarsDataFile(file)).summary).toMatchObject({ savedSources: 0, settings: 0 });
  });
});

describe('MARS data replacement', () => {
  it('replaces mirrored keys exactly, removing omitted ones and leaving other keys alone', async () => {
    const source = await populatedStorage();
    const data = captureMarsData(source.access);
    const target = memoryStorage({
      [PANE_LAYOUT_STORAGE_KEY]: '{"registerWidth":999,"editorFraction":0.1}',
      [`${ENGINE_SETTINGS_STORAGE_PREFIX}BareMachine`]: 'true',
      'mars-ts:engine-settings:v1:Retired': 'kept',
      'another-app:key': 'kept'
    });
    applyMarsData(data, target.access);
    expect(target.values.get('mars-ts:engine-settings:v1:Retired')).toBe('kept');
    expect(target.values.get('another-app:key')).toBe('kept');
    expect(target.values.has(`${ENGINE_SETTINGS_STORAGE_PREFIX}BareMachine`)).toBe(false);
    target.values.delete('mars-ts:engine-settings:v1:Retired');
    target.values.delete('another-app:key');
    expect(captureMarsData(target.access).storage).toEqual(data.storage);
    expect(target.values.get(THEME_STORAGE_KEY)).toBe('dark');
    expect(new SourceLibrary(target.access).read()).toEqual(
      new SourceLibrary(source.access).read()
    );
    expect(target.values.get(DESKTOP_SESSION_STORAGE_KEY)).toBe(
      JSON.stringify(data.storage[DESKTOP_SESSION_STORAGE_KEY])
    );
  });

  it('restores every previous record when a write fails', async () => {
    const data = captureMarsData((await populatedStorage()).access);
    const before = {
      [SOURCE_LIBRARY_STORAGE_KEY]: '[{"name":"keep.asm","source":"# keep\\n"}]',
      [THEME_STORAGE_KEY]: 'light',
      [`${ENGINE_SETTINGS_STORAGE_PREFIX}BareMachine`]: 'true'
    };
    const target = memoryStorage(before, DESKTOP_SESSION_STORAGE_KEY);
    expect(() => applyMarsData(data, target.access)).toThrow('Quota exceeded');
    expect(Object.fromEntries(target.values)).toEqual(before);
  });
});
