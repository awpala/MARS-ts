import { describe, expect, it } from 'vitest';
import { SimulatorNotice } from '#lib/engine/simulator/SimulatorNotice.js';
import {
  observesWrites,
  RUN_SPEED_MAX_POSITION,
  runSpeedLabel,
  runSpeedValue,
  UNLIMITED_SPEED
} from './runSpeed.js';

describe('run speed positions', () => {
  it('maps each distinct finite position to its speed and the endpoint to unlimited', () => {
    expect([0, 5, 6, 35].map(runSpeedValue)).toEqual([0.05, 0.5, 1, 30]);
    expect(RUN_SPEED_MAX_POSITION).toBe(36);
    for (const position of [36, 40]) expect(runSpeedValue(position)).toBe(UNLIMITED_SPEED);
  });
  it('labels positions as the machine will run them', () => {
    expect(runSpeedLabel(35)).toBe('30 inst/sec');
    expect(runSpeedLabel(36)).toBe('at max (no interaction)');
  });
});

describe('observesWrites', () => {
  const notice = (action: number, maxSteps: number, speed: number) =>
    new SimulatorNotice(action, maxSteps, speed, 0);
  it('follows finite-speed and single-step runs', () => {
    expect(observesWrites(notice(SimulatorNotice.SIMULATOR_START, -1, 30))).toBe(true);
    expect(observesWrites(notice(SimulatorNotice.SIMULATOR_START, 1, UNLIMITED_SPEED))).toBe(true);
  });
  it('ignores unlimited-speed runs and every stop notice', () => {
    expect(observesWrites(notice(SimulatorNotice.SIMULATOR_START, -1, UNLIMITED_SPEED))).toBe(
      false
    );
    expect(observesWrites(notice(SimulatorNotice.SIMULATOR_STOP, 1, 30))).toBe(false);
  });
});
