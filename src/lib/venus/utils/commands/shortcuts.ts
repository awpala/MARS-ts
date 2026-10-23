const ariaModifiers: Readonly<Record<string, string>> = { ctrl: 'Control', 'alt/option': 'Alt' };

/** Split displayed shortcut notation into alternative chords of keys: `Ctrl+Y / Ctrl+Shift+Z` becomes `[['Ctrl', 'Y'], ['Ctrl', 'Shift', 'Z']]`; `Alt/Option` is one key. */
export function shortcutChords(shortcut: string): string[][] {
  return shortcut.split(' / ').map((chord) => chord.split('+'));
}

/** Convert displayed shortcut notation to an `aria-keyshortcuts` value, naming Ctrl as Control and Alt/Option as Alt and omitting repeated chords. */
export function ariaKeyShortcuts(shortcut: string): string {
  const chords = shortcutChords(shortcut).map((keys) =>
    keys.map((key) => ariaModifiers[key.toLowerCase()] ?? key).join('+')
  );
  return [...new Set(chords)].join(' ');
}
