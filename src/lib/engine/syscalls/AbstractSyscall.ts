/* Copyright (c) 2003–2006 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/AbstractSyscall.java; see MARSlicense.txt. */
import type { ProgramStatement } from '../assembler/programs/ProgramStatement.js';
import type { Syscall } from './Syscall.js';
import type { SyscallHost } from './SyscallHost.js';

/** Canonical service name/number base; subclasses own behavior and retain their session host. */
export abstract class AbstractSyscall implements Syscall {
  /** Construct canonical metadata; the host remains owned by its simulator session. */
  constructor(
    private serviceNumber: number,
    private readonly serviceName: string,
    protected readonly host: SyscallHost
  ) {}
  /** Return the case-sensitive override name. */
  getName(): string {
    return this.serviceName;
  }
  /** Assign a signed32 service number. */
  setNumber(number: number): void {
    this.serviceNumber = number | 0;
  }
  /** Return the assigned service number. */
  getNumber(): number {
    return this.serviceNumber;
  }
  /** Execute against the owning session; asynchronous input must complete before the next instruction. */
  abstract simulate(statement: ProgramStatement): void | Promise<void>;
}
