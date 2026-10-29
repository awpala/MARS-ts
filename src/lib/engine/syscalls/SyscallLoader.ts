/* Copyright (c) 2003–2006 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/SyscallLoader.java; see MARSlicense.txt.
 * Original loader adapted from Bret Barker's GameServer class (Developing Games in Java). */
import type { SyscallHost } from './AbstractSyscall.js';
import type { Syscall } from './Syscall.js';
import { SyscallPrintInt } from './SyscallPrintInt.js';
import { SyscallPrintFloat } from './SyscallPrintFloat.js';
import { SyscallPrintDouble } from './SyscallPrintDouble.js';
import { SyscallPrintString } from './SyscallPrintString.js';
import { SyscallReadInt } from './SyscallReadInt.js';
import { SyscallReadFloat } from './SyscallReadFloat.js';
import { SyscallReadDouble } from './SyscallReadDouble.js';
import { SyscallReadString } from './SyscallReadString.js';
import { SyscallSbrk } from './SyscallSbrk.js';
import { SyscallExit } from './SyscallExit.js';
import { SyscallPrintChar } from './SyscallPrintChar.js';
import { SyscallReadChar } from './SyscallReadChar.js';
import { SyscallExit2 } from './SyscallExit2.js';
import { SyscallPrintIntHex } from './SyscallPrintIntHex.js';
import { SyscallPrintIntBinary } from './SyscallPrintIntBinary.js';
import { SyscallPrintIntUnsigned } from './SyscallPrintIntUnsigned.js';

import { SyscallRandSeed } from './SyscallRandSeed.js';
import { SyscallRandInt } from './SyscallRandInt.js';
import { SyscallRandIntRange } from './SyscallRandIntRange.js';
import { SyscallRandFloat } from './SyscallRandFloat.js';
import { SyscallRandDouble } from './SyscallRandDouble.js';
import { SyscallConfirmDialog } from './SyscallConfirmDialog.js';
import { SyscallInputDialogInt } from './SyscallInputDialogInt.js';
import { SyscallInputDialogFloat } from './SyscallInputDialogFloat.js';
import { SyscallInputDialogDouble } from './SyscallInputDialogDouble.js';
import { SyscallInputDialogString } from './SyscallInputDialogString.js';
import { SyscallMessageDialog } from './SyscallMessageDialog.js';
import { SyscallMessageDialogInt } from './SyscallMessageDialogInt.js';
import { SyscallMessageDialogFloat } from './SyscallMessageDialogFloat.js';
import { SyscallMessageDialogDouble } from './SyscallMessageDialogDouble.js';
import { SyscallMessageDialogString } from './SyscallMessageDialogString.js';

/** An explicitly linked module replaces Java classpath discovery without changing service lookup rules. */
export interface SyscallRegistration {
  /** Canonical class filename used for deduplication and initialization diagnostics. */
  className: string;
  /** Construct a fresh service bound to the supplied session. */
  create(host: SyscallHost): Syscall;
}
/** Parsed number override supplied by session configuration. */
export interface SyscallOverride {
  /** Case-sensitive service name. */
  getName(): string;
  /** Signed service number. */
  getNumber(): number;
}
/** Session-local loader retaining canonical duplicate detection, override ordering, and last-match lookup. */
export class SyscallLoader {
  private syscallList: Syscall[] | null = null;
  /** Implemented console, random, and dialog services; absent families resolve to null. */
  static readonly CORE_REGISTRATIONS: readonly SyscallRegistration[] = Object.freeze([
    Object.freeze({
      className: 'SyscallPrintInt.class',
      create: (host: SyscallHost) => new SyscallPrintInt(host)
    }),
    Object.freeze({
      className: 'SyscallPrintFloat.class',
      create: (host: SyscallHost) => new SyscallPrintFloat(host)
    }),
    Object.freeze({
      className: 'SyscallPrintDouble.class',
      create: (host: SyscallHost) => new SyscallPrintDouble(host)
    }),
    Object.freeze({
      className: 'SyscallPrintString.class',
      create: (host: SyscallHost) => new SyscallPrintString(host)
    }),
    Object.freeze({
      className: 'SyscallReadInt.class',
      create: (host: SyscallHost) => new SyscallReadInt(host)
    }),
    Object.freeze({
      className: 'SyscallReadFloat.class',
      create: (host: SyscallHost) => new SyscallReadFloat(host)
    }),
    Object.freeze({
      className: 'SyscallReadDouble.class',
      create: (host: SyscallHost) => new SyscallReadDouble(host)
    }),
    Object.freeze({
      className: 'SyscallReadString.class',
      create: (host: SyscallHost) => new SyscallReadString(host)
    }),
    Object.freeze({
      className: 'SyscallSbrk.class',
      create: (host: SyscallHost) => new SyscallSbrk(host)
    }),
    Object.freeze({
      className: 'SyscallExit.class',
      create: (host: SyscallHost) => new SyscallExit(host)
    }),
    Object.freeze({
      className: 'SyscallPrintChar.class',
      create: (host: SyscallHost) => new SyscallPrintChar(host)
    }),
    Object.freeze({
      className: 'SyscallReadChar.class',
      create: (host: SyscallHost) => new SyscallReadChar(host)
    }),
    Object.freeze({
      className: 'SyscallExit2.class',
      create: (host: SyscallHost) => new SyscallExit2(host)
    }),
    Object.freeze({
      className: 'SyscallPrintIntHex.class',
      create: (host: SyscallHost) => new SyscallPrintIntHex(host)
    }),
    Object.freeze({
      className: 'SyscallPrintIntBinary.class',
      create: (host: SyscallHost) => new SyscallPrintIntBinary(host)
    }),
    Object.freeze({
      className: 'SyscallPrintIntUnsigned.class',
      create: (host: SyscallHost) => new SyscallPrintIntUnsigned(host)
    }),
    Object.freeze({
      className: 'SyscallRandSeed.class',
      create: (host: SyscallHost) => new SyscallRandSeed(host)
    }),
    Object.freeze({
      className: 'SyscallRandInt.class',
      create: (host: SyscallHost) => new SyscallRandInt(host)
    }),
    Object.freeze({
      className: 'SyscallRandIntRange.class',
      create: (host: SyscallHost) => new SyscallRandIntRange(host)
    }),
    Object.freeze({
      className: 'SyscallRandFloat.class',
      create: (host: SyscallHost) => new SyscallRandFloat(host)
    }),
    Object.freeze({
      className: 'SyscallRandDouble.class',
      create: (host: SyscallHost) => new SyscallRandDouble(host)
    }),
    Object.freeze({
      className: 'SyscallConfirmDialog.class',
      create: (host: SyscallHost) => new SyscallConfirmDialog(host)
    }),
    Object.freeze({
      className: 'SyscallInputDialogInt.class',
      create: (host: SyscallHost) => new SyscallInputDialogInt(host)
    }),
    Object.freeze({
      className: 'SyscallInputDialogFloat.class',
      create: (host: SyscallHost) => new SyscallInputDialogFloat(host)
    }),
    Object.freeze({
      className: 'SyscallInputDialogDouble.class',
      create: (host: SyscallHost) => new SyscallInputDialogDouble(host)
    }),
    Object.freeze({
      className: 'SyscallInputDialogString.class',
      create: (host: SyscallHost) => new SyscallInputDialogString(host)
    }),
    Object.freeze({
      className: 'SyscallMessageDialog.class',
      create: (host: SyscallHost) => new SyscallMessageDialog(host)
    }),
    Object.freeze({
      className: 'SyscallMessageDialogInt.class',
      create: (host: SyscallHost) => new SyscallMessageDialogInt(host)
    }),
    Object.freeze({
      className: 'SyscallMessageDialogFloat.class',
      create: (host: SyscallHost) => new SyscallMessageDialogFloat(host)
    }),
    Object.freeze({
      className: 'SyscallMessageDialogDouble.class',
      create: (host: SyscallHost) => new SyscallMessageDialogDouble(host)
    }),
    Object.freeze({
      className: 'SyscallMessageDialogString.class',
      create: (host: SyscallHost) => new SyscallMessageDialogString(host)
    })
  ]);
  /** Bind explicit service factories and parsed overrides; configuration failures print then throw instead of exiting the browser. */
  constructor(
    private readonly host: SyscallHost,
    private readonly registrations: readonly SyscallRegistration[] = SyscallLoader.CORE_REGISTRATIONS,
    private readonly overrides: readonly SyscallOverride[] = [],
    private readonly writeConfiguration: (message: string) => void = (message) =>
      host.systemIO.printString(message)
  ) {}
  /** Rebuild service instances, deduplicate module names, then apply all overrides before checking final collisions. */
  loadSyscalls(): void {
    this.syscallList = [];
    const seen = new Set<string>();
    for (const registration of this.registrations) {
      const file = registration.className;
      if (seen.has(file)) continue;
      seen.add(file);
      if (file === 'Syscall.class' || file === 'AbstractSyscall.class') continue;
      try {
        const syscall = registration.create(this.host);
        const existing = this.findSyscall(syscall.getNumber());
        if (existing === null) this.syscallList.push(syscall);
        else
          throw new Error(
            `Duplicate service number: ${syscall.getNumber()} already registered to ${existing.getName()}`
          );
      } catch (error) {
        const description =
          error instanceof Error ? `java.lang.Exception: ${error.message}` : String(error);
        this.configurationFailure(`Error instantiating Syscall from file ${file}: ${description}`);
      }
    }
    for (const override of this.overrides) {
      let match = false;
      for (const syscall of this.syscallList)
        if (override.getName() === syscall.getName()) {
          syscall.setNumber(override.getNumber());
          match = true;
        }
      if (!match)
        this.configurationFailure(
          `Error: syscall name '${override.getName()}' in config file does not match any name in syscall list`
        );
    }
    let duplicates = false;
    for (let i = 0; i < this.syscallList.length; i++)
      for (let j = i + 1; j < this.syscallList.length; j++) {
        const a = this.syscallList[i],
          b = this.syscallList[j];
        if (a.getNumber() === b.getNumber()) {
          this.writeConfiguration(
            `Error: syscalls ${a.getName()} and ${b.getName()} are both assigned same number ${a.getNumber()}\n`
          );
          duplicates = true;
        }
      }
    if (duplicates) throw new Error('Invalid syscall configuration');
  }
  /** Lazily initialize, then return the last service with this number, or null if none is registered. */
  findSyscall(number: number): Syscall | null {
    if (this.syscallList === null) this.loadSyscalls();
    let match: Syscall | null = null;
    for (const syscall of this.syscallList!) if (syscall.getNumber() === number) match = syscall;
    return match;
  }
  private configurationFailure(message: string): never {
    this.writeConfiguration(message + '\n');
    throw new Error(message);
  }
}
