/* Copyright (c) 2003–2006 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Explicit registration adaptation for mars/mips/instructions/SyscallLoader.java; see MARSlicense.txt.
 * Original loader adapted from Bret Barker's GameServer class (Developing Games in Java). */
import type { SyscallHost } from './SyscallHost.js';
import type { Syscall } from './Syscall.js';

/** An explicitly linked module replaces Java classpath discovery without changing service lookup rules. */
export interface SyscallRegistration {
  /** Canonical class filename used for deduplication and initialization diagnostics. */
  className: string;
  /** Construct a fresh service bound to the supplied session. */
  create(host: SyscallHost): Syscall;
}
