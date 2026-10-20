const speedTable = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, ...Array.from({ length: 30 }, (_, i) => i + 1)];

/** Convert a legacy slider index (0–40) to instructions/second, or the unlimited sentinel 40. Caller supplies a validated slider position. */
export function runSpeedValue(position: number): number {
	return position > 35 ? 40 : speedTable[position];
}
/** Describe the same legacy slider position used to configure machine execution. */
export function runSpeedLabel(position: number): string {
	return position > 35 ? 'unlimited' : `${runSpeedValue(position)} inst/sec`;
}
