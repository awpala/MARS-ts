import { describe, expect, it } from 'vitest';
import {
  compareLabels,
  labelSortColumn,
  labelSortDescending,
  LABEL_SORT_STATES,
  nextLabelSortState,
  type SortableLabel
} from './labelSort.js';

const label = (name: string, address: number): SortableLabel => ({
  getName: () => name,
  getAddress: () => address
});

describe('label sort states', () => {
  it('reaches only valid states and remembers each column direction', () => {
    for (let state = 0; state < LABEL_SORT_STATES; state++)
      for (const column of [0, 1])
        expect(nextLabelSortState(state, column)).toBeLessThan(LABEL_SORT_STATES);
    // Address ascending (0): clicking Label moves to Label ascending (4); clicking Address descends (1).
    expect(nextLabelSortState(0, 0)).toBe(4);
    expect(nextLabelSortState(0, 1)).toBe(1);
  });
  it('derives the sorted column and direction from the state', () => {
    expect([0, 1, 2, 3].map(labelSortColumn)).toEqual([1, 1, 1, 1]);
    expect([4, 5, 6, 7].map(labelSortColumn)).toEqual([0, 0, 0, 0]);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(labelSortDescending)).toEqual([
      false,
      true,
      false,
      true,
      false,
      false,
      true,
      true
    ]);
  });
});

describe('compareLabels', () => {
  it('orders addresses as unsigned values', () => {
    const high = label('high', 0x80000000 | 0);
    const low = label('low', 0x00400000);
    expect(compareLabels(low, high, 0)).toBeLessThan(0);
    expect(compareLabels(low, high, 1)).toBeGreaterThan(0);
  });
  it('orders names without regard to case', () => {
    expect(compareLabels(label('Beta', 0), label('alpha', 0), 4)).toBeGreaterThan(0);
    expect(compareLabels(label('Beta', 0), label('alpha', 0), 6)).toBeLessThan(0);
    expect(compareLabels(label('Same', 0), label('same', 4), 4)).toBe(0);
  });
});
