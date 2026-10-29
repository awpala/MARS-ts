import { describe, expect, it } from 'vitest';
import {
  actionFor,
  breakpointActions,
  consoleActions,
  editActions,
  fileActions,
  helpActions,
  keyboardAction,
  physicalKeyAction,
  requireAction,
  runActions,
  toolbarGroups
} from './actions.js';
import { shortcutChords } from './shortcuts.js';

const allActions = [
  ...fileActions,
  ...editActions,
  ...runActions,
  ...breakpointActions,
  ...consoleActions,
  ...helpActions
];

function key(init: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: '',
    code: '',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...init
  } as KeyboardEvent;
}

describe('command catalog', () => {
  it('registers every command once and resolves it by name', () => {
    const commands = allActions.map((action) => action.command);
    expect(new Set(commands).size).toBe(commands.length);
    expect(actionFor('save')?.label).toBe('Save');
    expect(actionFor('nonexistent')).toBeUndefined();
    expect(requireAction('assemble').shortcut).toBe('F3');
    expect(() => requireAction('nonexistent')).toThrow('Unknown command: nonexistent');
  });
  it('never assigns one chord to two commands', () => {
    const owners = new Map<string, string>();
    for (const action of allActions)
      for (const chord of shortcutChords((action.shortcut ?? '').toLowerCase())) {
        const name = chord.join('+');
        if (name === '') continue;
        expect(owners.get(name), `${name} is shared`).toBeUndefined();
        owners.set(name, action.command);
      }
  });
  it('marks only the file-creating and closing shortcuts as non-repeating', () => {
    expect(allActions.filter((action) => action.noRepeat).map((action) => action.command)).toEqual([
      'new',
      'close',
      'closeAll'
    ]);
  });
  it('gives every toolbar action an icon', () => {
    for (const group of toolbarGroups)
      for (const action of group.actions) expect(action.icon, action.command).toBeDefined();
  });
  it('places Close All directly after Open in the file toolbar', () => {
    const file = toolbarGroups.find((group) => group.id === 'file')!;
    expect(file.actions.map((action) => action.command)).toEqual([
      'new',
      'open',
      'closeAll',
      'save',
      'saveAs',
      'autoSave',
      'import',
      'export',
      'exportAll',
      'dump'
    ]);
  });
});

describe('keyboardAction', () => {
  it('matches modifiers exactly, accepting Meta for Ctrl', () => {
    expect(keyboardAction(key({ key: 's', ctrlKey: true }))?.command).toBe('save');
    expect(keyboardAction(key({ key: 's', metaKey: true }))?.command).toBe('save');
    expect(keyboardAction(key({ key: 'S', ctrlKey: true, shiftKey: true }))?.command).toBe(
      'saveAs'
    );
    expect(keyboardAction(key({ key: 's' }))).toBeUndefined();
    expect(keyboardAction(key({ key: 'F5' }))?.command).toBe('go');
  });
  it('accepts either spelling of the Alt/Option alternative', () => {
    expect(keyboardAction(key({ key: 'n', altKey: true }))?.command).toBe('new');
    expect(keyboardAction(key({ key: 'z', ctrlKey: true, shiftKey: true }))?.command).toBe('redo');
  });
  it('distinguishes Close from Close All by Shift', () => {
    expect(keyboardAction(key({ key: 'w', altKey: true }))?.command).toBe('close');
    expect(keyboardAction(key({ key: 'W', altKey: true, shiftKey: true }))?.command).toBe(
      'closeAll'
    );
  });
});

describe('physicalKeyAction', () => {
  it('resolves Alt+letter shortcuts by physical key when Option changes the character', () => {
    expect(physicalKeyAction(key({ key: 'Dead', code: 'KeyN', altKey: true }))?.command).toBe(
      'new'
    );
    expect(physicalKeyAction(key({ key: '¬', code: 'KeyL', altKey: true }))?.command).toBe(
      'clearAllOutput'
    );
    expect(physicalKeyAction(key({ key: '∑', code: 'KeyW', altKey: true }))?.command).toBe('close');
  });
  it('resolves Alt+Shift+letter shortcuts by physical key, requiring Shift to match the chord', () => {
    expect(
      physicalKeyAction(key({ key: '„', code: 'KeyW', altKey: true, shiftKey: true }))?.command
    ).toBe('closeAll');
    expect(physicalKeyAction(key({ key: '∑', code: 'KeyW', altKey: true }))?.command).not.toBe(
      'closeAll'
    );
  });
  it('ignores other modifiers, plain keys, and keys without an Alt shortcut', () => {
    expect(physicalKeyAction(key({ code: 'KeyN' }))).toBeUndefined();
    expect(physicalKeyAction(key({ code: 'KeyN', altKey: true, ctrlKey: true }))).toBeUndefined();
    expect(physicalKeyAction(key({ code: 'KeyN', altKey: true, shiftKey: true }))).toBeUndefined();
    expect(physicalKeyAction(key({ code: 'KeyZ', altKey: true }))).toBeUndefined();
    expect(physicalKeyAction(key({ code: 'F3', altKey: true }))).toBeUndefined();
  });
});
