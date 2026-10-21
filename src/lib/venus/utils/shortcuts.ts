const ariaModifiers: Readonly<Record<string, string>> = { ctrl: 'Control', option: 'Alt' };

/** Split displayed shortcut notation into alternative chords of keys: `Alt+N / Option+N` becomes `[['Alt', 'N'], ['Option', 'N']]`. */
export function shortcutChords(shortcut: string): string[][] {
  return shortcut.split(' / ').map((chord) => chord.split('+'));
}

/** Convert displayed shortcut notation to an `aria-keyshortcuts` value, naming Ctrl as Control and Option as Alt and omitting repeated chords. */
export function ariaKeyShortcuts(shortcut: string): string {
  const chords = shortcutChords(shortcut).map((keys) =>
    keys.map((key) => ariaModifiers[key.toLowerCase()] ?? key).join('+')
  );
  return [...new Set(chords)].join(' ');
}
