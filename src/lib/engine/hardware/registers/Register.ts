/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/hardware/Register.java. */
import { AccessNotice, type AccessOrigin } from '../notices/AccessNotice.js';
import { RegisterAccessNotice } from '../notices/RegisterAccessNotice.js';

/** A register listener; the subscriber owns the returned unsubscribe function. */
export type RegisterObserver = (notice: RegisterAccessNotice) => void;

/** A session-owned signed 32-bit register with synchronous Java-order notifications. */
export class Register {
  private value: number;
  private initial: number;
  private readonly observers = new Set<RegisterObserver>();
  /** Creates a register; origin is resolved for each access, defaulting to other. */
  constructor(
    private readonly name: string,
    private readonly number: number,
    value: number,
    private readonly origin: () => AccessOrigin = () => 'other'
  ) {
    this.value = value | 0;
    this.initial = value | 0;
  }
  /** Returns the register's mnemonic. */
  getName(): string {
    return this.name;
  }
  /** Notifies readers, then returns the possibly observer-modified value. */
  getValue(): number {
    this.notify(AccessNotice.READ);
    return this.value;
  }
  /** Returns the value without generating tool notices; use for UI snapshots. */
  getValueNoNotify(): number {
    return this.value;
  }
  /** Returns the reset value. */
  getResetValue(): number {
    return this.initial;
  }
  /** Returns the architectural or internal register number. */
  getNumber(): number {
    return this.number;
  }
  /** Writes, notifies observers, and returns the previous signed value. */
  setValue(value: number): number {
    const old = this.value;
    this.value = value | 0;
    this.notify(AccessNotice.WRITE);
    return old;
  }
  /** Restores the reset value without notification. */
  resetValue(): void {
    this.value = this.initial;
  }
  /** Changes only the reset value. */
  changeResetValue(value: number): void {
    this.initial = value | 0;
  }
  /** Subscribes once per callback identity; release the subscription when its owner closes. */
  subscribe(observer: RegisterObserver): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }
  private notify(type: number): void {
    if (!this.observers.size) return;
    const notice = new RegisterAccessNotice(type, this.name, this.origin());
    for (const observer of [...this.observers].reverse()) observer(notice);
  }
}
