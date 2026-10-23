/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Sort states derive from mars/venus/LabelsWindow.java. */
import type { Symbol as AssemblySymbol } from '#lib/engine/assembler/symbols/Symbol.js';

/** The symbol fields a Labels row is ordered by. */
export type SortableLabel = Pick<AssemblySymbol, 'getName' | 'getAddress'>;

/** Labels table column headings, in column-index order. */
export const LABEL_COLUMNS = ['Label', 'Address'] as const;

/** Highest of the eight legacy sort states. */
export const LABEL_SORT_STATES = 8;

/** Next state per current state and clicked column; LabelsWindow remembers each column's direction when switching columns. */
const transitions: readonly (readonly [number, number])[] = [
  [4, 1],
  [5, 0],
  [6, 3],
  [7, 2],
  [6, 0],
  [7, 1],
  [4, 2],
  [5, 3]
];

/** State selected by clicking a column heading while in the given state. */
export function nextLabelSortState(state: number, column: number): number {
  return transitions[state][column];
}

/** Index of the column a state sorts by: the Address column for states 0–3, otherwise Label. */
export function labelSortColumn(state: number): number {
  return state < 4 ? 1 : 0;
}

/** Whether a state sorts its column in descending order. */
export function labelSortDescending(state: number): boolean {
  return (state & (labelSortColumn(state) === 0 ? 2 : 1)) !== 0;
}

/** Order two labels as the state requires: unsigned addresses, or case-insensitive names. */
export function compareLabels(left: SortableLabel, right: SortableLabel, state: number): number {
  const descending = labelSortDescending(state);
  const a = descending ? right : left;
  const b = descending ? left : right;
  if (labelSortColumn(state) === 1) return (a.getAddress() >>> 0) - (b.getAddress() >>> 0);
  const nameA = a.getName().toLowerCase();
  const nameB = b.getName().toLowerCase();
  return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
}
