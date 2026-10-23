import { tick } from 'svelte';
import type { SourceWorkspace } from './SourceWorkspace.svelte.js';
/** Per-desktop find/replace state acting through the workspace's existing edit/history contract. */
export class SourceSearch {
  /** Current search query; an empty query performs no operation. */
  findText = $state('');
  /** Replacement source text. */
  replacement = $state('');
  /** Whether search and replacement match case. */
  caseSensitive = $state(false);
  /** Status of the latest search or replacement. */
  findStatus = $state('');
  /** Retain the workspace whose selected source and caret are searched. */
  constructor(private readonly workspace: SourceWorkspace) {}
  /** Text as compared by the current case setting. */
  private fold(text: string): string {
    return this.caseSensitive ? text : text.toLowerCase();
  }
  /** Select the next match, wrapping to the beginning of the active source. */
  findNext = async () => {
    if (!this.workspace.current || !this.findText) return;
    const text = this.fold(this.workspace.current.text);
    const query = this.fold(this.findText);
    let index = text.indexOf(query, this.workspace.selectionEnd);
    if (index < 0) index = text.indexOf(query);
    if (index < 0) {
      this.findStatus = 'Text not found.';
      return;
    }
    this.workspace.selectionStart = index;
    this.workspace.selectionEnd = index + this.findText.length;
    await tick();
    this.workspace.sourceInput?.setSelectionRange(
      this.workspace.selectionStart,
      this.workspace.selectionEnd
    );
    this.findStatus = `Match at character ${index + 1}.`;
  };
  /** Replace the selected match or all matches through the normal source-edit workflow. */
  replace = (all = false) => {
    if (!this.workspace.current || !this.findText) return;
    const query = this.fold(this.findText);
    if (!all) {
      const selected = this.workspace.current.text.slice(
        this.workspace.selectionStart,
        this.workspace.selectionEnd
      );
      if (this.fold(selected) === query) {
        this.workspace.edit(
          this.workspace.current.text.slice(0, this.workspace.selectionStart) +
            this.replacement +
            this.workspace.current.text.slice(this.workspace.selectionEnd)
        );
        this.workspace.selectionEnd = this.workspace.selectionStart + this.replacement.length;
      }
      void this.findNext();
      return;
    }
    const source = this.workspace.current.text,
      comparable = this.fold(source);
    let output = '',
      offset = 0,
      count = 0,
      index = comparable.indexOf(query);
    while (index >= 0) {
      output += source.slice(offset, index) + this.replacement;
      offset = index + this.findText.length;
      count++;
      index = comparable.indexOf(query, offset);
    }
    this.workspace.edit(output + source.slice(offset));
    this.findStatus = `${count} occurrence(s) replaced.`;
  };
}
