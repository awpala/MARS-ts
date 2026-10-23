import { describe, expect, it } from 'vitest';
import { clamp } from './clamp.js';

describe('clamp', () => {
  it('limits values to an inclusive range', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(11, 0, 10)).toBe(10);
  });
  it('keeps the lower bound when the bounds cross', () => {
    expect(clamp(5, 150, 100)).toBe(150);
  });
});
