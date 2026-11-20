/* Ported from mars/venus/editors/jeditsyntax/DefaultInputHandler.java, InputHandler.java, TextUtilities.java, and JEditTextArea.java in MARS.
 * Copyright (c) 2003-2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 *
 * Copyright (C) 1999 Slava Pestov
 * You may use and modify this package for any purpose. Redistribution is
 * permitted, in both source and binary form, provided that this notice
 * remains intact in all source distributions of this package.
 */
import { columnRanges, replaceColumns, rowEnd, rowStart } from '#lib/editor/columnSelection.js';

/** One source tab's transient jEdit keyboard modes. The workspace owns history and persistence. */
export class EditorInput {
  /** Whether typed characters overwrite existing characters before the end of a row. */
  overwrite = $state(false);
  /** Whether the selection endpoints denote opposite corners of a rectangle. */
  rectangular = $state(false);
  private repeatCount = $state<number | null>(null);

  /** Active source commands acknowledged in the Edit footer, including the effective repeat count. */
  get feedback(): string {
    const active: string[] = [];
    if (this.rectangular) active.push('Rectangular selection (Ctrl+\\)');
    if (this.repeatCount !== null)
      active.push(`Repeat ×${Math.max(1, this.repeatCount)} (Ctrl+Enter)`);
    return active.join(' · ');
  }

  /** Toggle the current selection's shape, honoring a pending repeat prefix. */
  toggleRectangle(): void {
    if (this.takeCount() % 2) this.rectangular = !this.rectangular;
  }

  /** Whether a native clipboard event needs to apply the numeric prefix. */
  get repeating(): boolean {
    return this.repeatCount !== null;
  }

  /** Produce the input or clipboard text for a counted command and consume its prefix. */
  counted(text: string): string {
    return text.repeat(this.takeCount());
  }

  /** Read the exact text that Copy or Cut would place on the clipboard. */
  selected(text: string, start: number, end: number): string {
    if (!this.rectangular || start === end) return text.slice(start, end);
    return columnRanges(text, start, end)
      .map((range) => text.slice(range.start, range.end))
      .join('\n');
  }

  /** Compute a replacement and collapse the rectangle after the edit. */
  replace(text: string, start: number, end: number, replacement: string, overstrike = false) {
    if (this.rectangular && start !== end) {
      this.rectangular = false;
      return replaceColumns(text, columnRanges(text, start, end), replacement);
    }
    this.rectangular = false;
    if (
      overstrike &&
      this.overwrite &&
      start === end &&
      rowEnd(text, start) - start >= replacement.length
    )
      end += replacement.length;
    return {
      text: text.slice(0, start) + replacement + text.slice(end),
      caret: start + replacement.length
    };
  }

  private takeCount(): number {
    const count = Math.max(1, this.repeatCount ?? 1);
    this.repeatCount = null;
    return count;
  }

  /** Adapt a cancellable native typing or deletion to the active jEdit modes. */
  beforeInput(event: InputEvent, input: HTMLTextAreaElement, commit: () => void): void {
    if (input.readOnly || event.isComposing || !event.cancelable) return;
    const { selectionStart: start, selectionEnd: end } = input;
    const rectangle = this.rectangular && start !== end;
    if (
      event.inputType === 'insertText' &&
      event.data !== null &&
      (this.overwrite || rectangle || this.repeatCount !== null)
    ) {
      event.preventDefault();
      this.apply(input, start, end, this.counted(event.data), commit, true);
    } else if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') {
      event.preventDefault();
      this.insertLayout(
        input,
        start,
        end,
        input.selectionDirection === 'backward' ? start : end,
        'Enter',
        commit
      );
    } else if (rectangle && event.inputType.startsWith('delete')) {
      event.preventDefault();
      this.apply(input, start, end, '', commit);
    }
  }

  private apply(
    input: HTMLTextAreaElement,
    start: number,
    end: number,
    replacement: string,
    commit: () => void,
    overstrike = false
  ): void {
    const result = this.replace(input.value, start, end, replacement, overstrike);
    input.value = result.text;
    input.setSelectionRange(result.caret, result.caret);
    commit();
  }

  /** Intercept jEdit commands while leaving ordinary browser editing and IME input native. */
  keydown(event: KeyboardEvent, input: HTMLTextAreaElement, commit: () => void): void {
    if (event.isComposing || event.altKey || event.metaKey) return;
    const { key, ctrlKey, shiftKey } = event;
    const { selectionStart: start, selectionEnd: end } = input;
    const caret = input.selectionDirection === 'backward' ? start : end;
    if (ctrlKey && !shiftKey && key === 'Enter') {
      this.repeatCount = 0;
    } else if (key === 'Escape' && this.repeatCount !== null) {
      this.repeatCount = null;
    } else if (this.repeatCount !== null && !ctrlKey && /^[0-9]$/.test(key)) {
      // DefaultInputHandler accumulates a signed Java int.
      this.repeatCount = (this.repeatCount * 10 + Number(key)) | 0;
    } else if (
      this.repeatCount !== null &&
      /^(Arrow(Left|Right|Up|Down)|Home|End|PageUp|PageDown)$/.test(key)
    ) {
      this.move(input, key, ctrlKey, shiftKey, this.takeCount());
    } else if (ctrlKey && key.toLowerCase() === 'a') {
      this.rectangular = false;
      this.takeCount();
      return;
    } else if (input.readOnly || (ctrlKey && key !== 'Backspace' && key !== 'Delete')) {
      return;
    } else if (!shiftKey && key === 'Insert') {
      if (this.takeCount() % 2) this.overwrite = !this.overwrite;
    } else if (key === 'Enter' || (key === 'Tab' && !shiftKey)) {
      this.insertLayout(input, start, end, caret, key, commit);
    } else if (
      (key === 'Backspace' || key === 'Delete') &&
      (this.repeatCount !== null || (this.rectangular && start !== end))
    ) {
      let count = this.takeCount();
      if (start !== end) {
        this.apply(input, start, end, '', commit);
        count--;
      }
      const pos = input.selectionEnd;
      if (count) {
        const target = this.horizontal(input.value, pos, key === 'Backspace', ctrlKey, count);
        this.apply(input, Math.min(pos, target), Math.max(pos, target), '', commit);
      }
    } else {
      return;
    }
    event.preventDefault();
  }

  private insertLayout(
    input: HTMLTextAreaElement,
    start: number,
    end: number,
    caret: number,
    key: 'Tab' | 'Enter',
    commit: () => void
  ): void {
    const count = this.takeCount();
    const indentAt = (text: string, at: number) =>
      /^[ \t]*/.exec(text.slice(rowStart(text, at)))![0];
    const unit = key === 'Tab' ? '\t' : '\n' + indentAt(input.value, caret);
    // The first command may remove a rectangular selection. Further commands start at that edit's caret.
    const first = this.replace(input.value, start, end, unit, key === 'Tab');
    let tail = first.caret;
    let extra = '';
    if (count > 1 && key === 'Tab') {
      extra = '\t'.repeat(count - 1);
      if (this.overwrite) tail = Math.min(tail + extra.length, rowEnd(first.text, tail));
    } else if (count > 1) {
      let indent = indentAt(first.text, tail);
      // Splitting a line inside its leading whitespace carries the suffix to each new line.
      const prefix = first.text.slice(rowStart(first.text, tail), tail);
      const suffix = indent.startsWith(prefix) ? indent.slice(prefix.length) : '';
      if (suffix) {
        const lines: string[] = [];
        for (let i = 1; i < count; i++) {
          lines.push('\n' + indent);
          indent += suffix;
        }
        extra = lines.join('');
      } else extra = ('\n' + indent).repeat(count - 1);
    }
    input.value = first.text.slice(0, first.caret) + extra + first.text.slice(tail);
    const position = first.caret + extra.length;
    input.setSelectionRange(position, position);
    commit();
  }

  private horizontal(
    value: string,
    caret: number,
    left: boolean,
    wholeWords: boolean,
    count: number
  ): number {
    const direction = left ? -1 : 1;
    if (!wholeWords) return Math.max(0, Math.min(value.length, caret + direction * count));
    // TextUtilities groups letters and digits, and groups punctuation with whitespace within a row.
    const word = /[\p{L}\p{Nd}]/u;
    for (let i = 0; i < count; i++) {
      let index = left ? caret - 1 : caret;
      const ch = value[index];
      if (ch === undefined) break;
      caret += direction;
      if (ch === '\n') continue;
      const letters = word.test(ch);
      index += direction;
      while (
        index >= 0 &&
        index < value.length &&
        value[index] !== '\n' &&
        word.test(value[index]) === letters
      ) {
        caret += direction;
        index += direction;
      }
    }
    return caret;
  }

  private move(
    input: HTMLTextAreaElement,
    key: string,
    ctrl: boolean,
    extend: boolean,
    count: number
  ): void {
    const value = input.value;
    const backward = input.selectionDirection === 'backward';
    const anchor = backward ? input.selectionEnd : input.selectionStart;
    let caret = backward ? input.selectionStart : input.selectionEnd;
    const start = rowStart(value, caret);
    if (key === 'Home') caret = ctrl ? 0 : start;
    else if (key === 'End') caret = ctrl ? value.length : rowEnd(value, caret);
    else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const left = key === 'ArrowLeft';
      caret = this.horizontal(value, caret, left, ctrl, count);
    } else {
      const up = key === 'ArrowUp' || key === 'PageUp';
      const rows = key.startsWith('Page')
        ? Math.max(
            1,
            Math.floor(input.clientHeight / parseFloat(getComputedStyle(input).lineHeight))
          )
        : 1;
      let target = start;
      for (let i = 0; i < count * rows; i++) {
        const next = up ? rowStart(value, Math.max(0, target - 1)) : rowEnd(value, target) + 1;
        if (next > value.length || next === target) break;
        target = next;
      }
      caret = Math.min(target + caret - start, rowEnd(value, target));
    }
    if (extend)
      input.setSelectionRange(
        Math.min(anchor, caret),
        Math.max(anchor, caret),
        caret < anchor ? 'backward' : 'forward'
      );
    else input.setSelectionRange(caret, caret);
    if (input.selectionStart === input.selectionEnd) this.rectangular = false;
  }
}
