/* Ported from mars/venus/editors/jeditsyntax/JEditTextArea.java in MARS.
 * Copyright (c) 2003-2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 *
 * Copyright (C) 1999 Slava Pestov
 * You may use and modify this package for any purpose. Redistribution is
 * permitted, in both source and binary form, provided that this notice
 * remains intact in all source distributions of this package.
 */

/** One affected row. Offsets are UTF-16 indices into the original document. */
export interface ColumnRange {
  /** First character of the row. */
  lineStart: number;
  /** Newline or end of document. */
  lineEnd: number;
  /** Inclusive start of the selected columns. */
  start: number;
  /** Exclusive end, clipped at the end of a short row. */
  end: number;
}

/** Find the beginning of the row containing a caret, including the empty first row. */
export function rowStart(text: string, caret: number): number {
  return caret === 0 ? 0 : text.lastIndexOf('\n', caret - 1) + 1;
}

/** Return the newline following the caret, or the end of the document. */
export function rowEnd(text: string, caret: number): number {
  const end = text.indexOf('\n', caret);
  return end < 0 ? text.length : end;
}

/** Intersect the two corner columns with each selected row, including empty rows. */
export function columnRanges(text: string, start: number, end: number): ColumnRange[] {
  const first = rowStart(text, start);
  const last = rowStart(text, end);
  const left = Math.min(start - first, end - last);
  const right = Math.max(start - first, end - last);
  const ranges: ColumnRange[] = [];
  for (let lineStart = first; lineStart <= last;) {
    const lineEnd = rowEnd(text, lineStart);
    ranges.push({
      lineStart,
      lineEnd,
      start: Math.min(lineStart + left, lineEnd),
      end: Math.min(lineStart + right, lineEnd)
    });
    lineStart = lineEnd + 1;
  }
  return ranges;
}

/** Replace each selected row with the corresponding pasted line. Surplus lines follow the last affected row. */
export function replaceColumns(text: string, ranges: readonly ColumnRange[], replacement: string) {
  const lines = replacement.split('\n');
  const pieces: string[] = [];
  let offset = 0;
  let caret = 0;
  for (const [i, range] of ranges.entries()) {
    const inserted = lines[i] ?? '';
    pieces.push(text.slice(offset, range.start), inserted);
    caret += range.start - offset + inserted.length;
    offset = range.end;
  }
  if (lines.length > ranges.length) {
    const lastEnd = ranges[ranges.length - 1].lineEnd;
    const extra = '\n' + lines.slice(ranges.length).join('\n');
    pieces.push(text.slice(offset, lastEnd), extra);
    caret += lastEnd - offset + extra.length;
    offset = lastEnd;
  }
  pieces.push(text.slice(offset));
  return { text: pieces.join(''), caret };
}
