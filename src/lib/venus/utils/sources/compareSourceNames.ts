/** Compare virtual source names case-insensitively, with exact spelling as the deterministic tie-breaker; never mutates sources or tab order. */
export function compareSourceNames(left: string, right: string): number {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (a !== b) return a < b ? -1 : 1;
  return left < right ? -1 : left > right ? 1 : 0;
}
