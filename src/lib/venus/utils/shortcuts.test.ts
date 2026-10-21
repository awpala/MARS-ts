import { describe, expect, it } from 'vitest';
import { ariaKeyShortcuts, shortcutChords } from './shortcuts.js';

describe('shortcut notation', () => {
  it('splits alternatives and keys in displayed order', () => {
    expect(shortcutChords('F3')).toEqual([['F3']]);
    expect(shortcutChords('Ctrl+Shift+S')).toEqual([['Ctrl', 'Shift', 'S']]);
    expect(shortcutChords('Alt+N / Option+N')).toEqual([
      ['Alt', 'N'],
      ['Option', 'N']
    ]);
  });
  it('names ARIA modifiers and omits equivalent alternatives', () => {
    expect(ariaKeyShortcuts('Ctrl+L')).toBe('Control+L');
    expect(ariaKeyShortcuts('Alt+L / Option+L')).toBe('Alt+L');
    expect(ariaKeyShortcuts('Ctrl+Y / Ctrl+Shift+Z')).toBe('Control+Y Control+Shift+Z');
  });
});
