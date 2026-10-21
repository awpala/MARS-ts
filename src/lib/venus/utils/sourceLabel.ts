/** Display a source filename with the leading `* ` marker the desktop uses for unsaved changes. */
export function sourceLabel(name: string, dirty: boolean): string {
  return `${dirty ? '* ' : ''}${name}`;
}
