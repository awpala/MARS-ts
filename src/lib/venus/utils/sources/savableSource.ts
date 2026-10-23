import type { EditPane } from '#lib/editor/Editor.js';

/** Whether a buffer may be committed to the source library: new buffers need at least one character, while saved sources may be cleared and saved empty. */
export function isSavableSource(tab: Pick<EditPane, 'isNew' | 'text'>): boolean {
  return !tab.isNew || tab.text.length > 0;
}
