/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Speed values derive from mars/venus/RunSpeedPanel.java and the write-observation rule of its register and memory windows. */
import { SimulatorNotice } from '#lib/engine/simulator/SimulatorNotice.js';

const speedTable = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, ...Array.from({ length: 30 }, (_, i) => i + 1)];

/** Run speed the engine treats as unlimited; ports `RunSpeedPanel.UNLIMITED_SPEED`. */
export const UNLIMITED_SPEED = 40;

/** Final UI position, following each distinct finite speed; maximum speed occupies this endpoint only. */
export const RUN_SPEED_MAX_POSITION = speedTable.length;

/** Convert a legacy slider index (0–40) to instructions/second, or the unlimited sentinel. Caller supplies a validated slider position. */
export function runSpeedValue(position: number): number {
  return position >= RUN_SPEED_MAX_POSITION ? UNLIMITED_SPEED : speedTable[position];
}
/** Describe the same legacy slider position used to configure machine execution. */
export function runSpeedLabel(position: number): string {
  return position >= RUN_SPEED_MAX_POSITION
    ? 'at max (no interaction)'
    : `${runSpeedValue(position)} inst/sec`;
}
/** Whether a simulator notice starts a run whose register and memory writes the debugger follows: a stepped or finite-speed run, as in the legacy windows. */
export function observesWrites(notice: SimulatorNotice): boolean {
  return (
    notice.getAction() === SimulatorNotice.SIMULATOR_START &&
    (notice.getRunSpeed() !== UNLIMITED_SPEED || notice.getMaxSteps() === 1)
  );
}
