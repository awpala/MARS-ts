/* Copyright (c) 2003–2006 Pete Sanderson and Kenneth Vollmar. MIT; see MARSlicense.txt.
 * Ports the private circular BackstepStack in mars/simulator/BackStepper.java. */
import { BackStep, type BackStepAction, type BackStepContext } from './BackStep.js';

/** Fixed-capacity circular undo stack, preallocating records and overwriting the oldest on overflow. */
export class BackstepStack<Statement> {
  private size = 0;
  private top = -1;
  private readonly stack: BackStep<Statement>[];
  /** Allocates the session's entire undo history once; capacity comes from configuration. */
  constructor(
    private readonly capacity: number,
    private readonly context: BackStepContext<Statement>
  ) {
    if (!Number.isInteger(capacity) || capacity < 0)
      throw new RangeError('Invalid backstep capacity');
    this.stack = Array.from({ length: capacity }, () => new BackStep<Statement>());
  }
  /** Copy retained records oldest first; statement identities remain owned by the machine. */
  captureState(): Omit<BackStep<Statement>, 'assign'>[] {
    return Array.from({ length: this.size }, (_, i) => ({
      ...this.stack[(this.top - this.size + 1 + i + this.capacity) % this.capacity]
    }));
  }
  /** Replace history with validated oldest-first records, preserving restored statement identity groups. */
  restoreState(records: readonly Omit<BackStep<Statement>, 'assign'>[]): void {
    if (records.length > this.capacity)
      throw new RangeError('Checkpoint exceeds backstep capacity');
    this.size = records.length;
    this.top = records.length - 1;
    for (let i = 0; i < records.length; i++) Object.assign(this.stack[i], records[i]);
  }
  /** Whether no undo records are retained. */
  empty(): boolean {
    return this.size === 0;
  }
  /** Pushes by rewriting the next preallocated record, preserving Java wrap and grouping behavior. */
  push(action: BackStepAction, pc: number, param1 = 0, param2 = 0): void {
    if (this.size === 0) {
      this.top = 0;
      this.size++;
    } else if (this.size < this.capacity) {
      this.top = (this.top + 1) % this.capacity;
      this.size++;
    } else {
      this.top = (this.top + 1) % this.capacity;
    }
    this.stack[this.top].assign(action, pc, param1, param2, this.context);
  }
  /** Removes the newest record; caller must establish nonempty first. The returned object is reused. */
  pop(): BackStep<Statement> {
    const result = this.stack[this.top];
    this.top = this.size === 1 ? -1 : (this.top + this.capacity - 1) % this.capacity;
    this.size--;
    return result;
  }
  /** Reads the newest record; caller must establish nonempty first. */
  peek(): BackStep<Statement> {
    return this.stack[this.top];
  }
}
