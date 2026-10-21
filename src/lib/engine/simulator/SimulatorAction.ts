/* Copyright (c) 2003–2010 Pete Sanderson and Kenneth Vollmar. MIT; see MARSlicense.txt.
 * Adapts the AbstractAction callbacks consumed by mars/simulator/Simulator.java. */
import type { ProcessingException } from '../diagnostics/ProcessingException.js';

/** Browser-neutral counterpart of the initiating/stopping Venus action; owns no DOM objects. */
export interface SimulatorAction {
  /** Canonical action name, ordinarily Step, Go, Pause, or Stop. */
  readonly name: string;
  /** Called when a Step finishes, preserving Java's completion flag and stop reason. */
  stepped?(done: boolean, reason: number, error: ProcessingException | null): void;
  /** Called when Go pauses at a breakpoint or through the Pause action. */
  paused?(done: boolean, reason: number, error: ProcessingException | null): void;
  /** Called when Go ends normally, with an exception, or through Stop. */
  stopped?(error: ProcessingException | null, reason: number): void;
}
