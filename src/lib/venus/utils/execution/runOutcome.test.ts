import { describe, expect, it } from 'vitest';
import { Simulator } from '#lib/engine/simulator/Simulator.js';
import type { RunState } from '../../RunController.js';
import { describeRunOutcome } from './runOutcome.js';

const state = (update: Partial<RunState>): RunState => ({
  revision: 1,
  status: 'terminated',
  started: true,
  reset: false,
  reason: 0,
  error: null,
  diagnostics: null,
  programs: [],
  statements: [],
  ...update
});

describe('describeRunOutcome', () => {
  it('reports normal Go completion on the program console', () => {
    expect(
      describeRunOutcome('go', state({ reason: Simulator.NORMAL_TERMINATION }), 'a.asm')
    ).toEqual({
      messages: '\nGo: execution completed successfully.\n\n',
      runIO: '\n-- program is finished running --\n\n',
      messageTab: 'Run I/O'
    });
  });
  it('reports falling off the end of the program', () => {
    const go = describeRunOutcome('go', state({ reason: Simulator.CLIFF_TERMINATION }), 'a.asm');
    expect(go.messages).toBe('\nGo: execution terminated by null instruction.\n\n');
    expect(go.runIO).toBe('\n-- program is finished running (dropped off bottom) --\n\n');
    const step = describeRunOutcome(
      'step',
      state({ reason: Simulator.CLIFF_TERMINATION }),
      'a.asm'
    );
    expect(step.messages).toBe('\nStep: execution terminated due to null instruction.\n\n');
    expect(step.runIO).toBe('\n-- program is finished running (dropped off bottom) --\n\n');
  });
  it('keeps the legacy Step completion spacing', () => {
    const step = describeRunOutcome('step', state({ reason: Simulator.MAX_STEPS }), 'a.asm');
    expect(step.messages).toBe('\nStep: execution completed successfully.\n\n');
    expect(step.runIO).toBe('\n-- program is finished running  --\n\n');
    expect(step.messageTab).toBe('Run I/O');
  });
  it('returns to Mars Messages when the user stops Go', () => {
    expect(describeRunOutcome('go', state({ reason: Simulator.PAUSE_OR_STOP }), 'a.asm')).toEqual({
      messages: '\nGo: execution terminated by user.\n\n',
      runIO: '',
      messageTab: 'Mars Messages'
    });
  });
  it('names the program when Go pauses', () => {
    const paused = (reason: number) =>
      describeRunOutcome('go', state({ status: 'paused', reason }), 'a.asm').messages;
    expect(paused(Simulator.BREAKPOINT)).toBe('Go: execution paused at breakpoint: a.asm\n\n');
    expect(paused(Simulator.PAUSE_OR_STOP)).toBe('Go: execution paused by user: a.asm\n\n');
  });
  it('reports nothing for a paused Step', () => {
    expect(describeRunOutcome('step', state({ status: 'paused' }), 'a.asm')).toEqual({
      messages: '',
      runIO: ''
    });
  });
});
