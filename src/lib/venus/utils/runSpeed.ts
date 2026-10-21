const speedTable = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, ...Array.from({ length: 30 }, (_, i) => i + 1)];

/** Final UI position, following each distinct finite speed; maximum speed occupies this endpoint only. */
export const RUN_SPEED_MAX_POSITION = speedTable.length;

/** Convert a legacy slider index (0–40) to instructions/second, or the unlimited sentinel 40. Caller supplies a validated slider position. */
export function runSpeedValue(position: number): number {
  return position >= RUN_SPEED_MAX_POSITION ? 40 : speedTable[position];
}
/** Describe the same legacy slider position used to configure machine execution. */
export function runSpeedLabel(position: number): string {
  return position >= RUN_SPEED_MAX_POSITION
    ? 'at max (no interaction)'
    : `${runSpeedValue(position)} inst/sec`;
}
