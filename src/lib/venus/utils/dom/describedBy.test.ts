import { describe, expect, it } from 'vitest';
import { describedBy } from './describedBy.js';

describe('describedBy', () => {
  it('joins the present IDs in order', () => {
    expect(describedBy('caller', 'tooltip')).toBe('caller tooltip');
    expect(describedBy(undefined, 'tooltip')).toBe('tooltip');
  });
  it('omits the attribute when no ID applies', () => {
    expect(describedBy()).toBeUndefined();
    expect(describedBy(undefined, '')).toBeUndefined();
  });
});
