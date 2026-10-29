import type { EditPane } from '#lib/editor/Editor.js';

/** Whether a buffer may be committed: references are excluded, new buffers need at least one character, and saved sources may be cleared and saved empty. */
export function isSavableSource(tab: Pick<EditPane, 'isNew' | 'text' | 'readOnly'>): boolean {
  return !tab.readOnly && (!tab.isNew || tab.text.length > 0);
}
