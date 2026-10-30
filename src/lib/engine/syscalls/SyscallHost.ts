/* Copyright (c) 2003–2006 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Session host adaptation for mars/mips/instructions/syscalls/AbstractSyscall.java; see MARSlicense.txt. */
import type { ProgramStatement } from '../assembler/programs/ProgramStatement.js';
import type { ProcessingExceptionHost } from '../diagnostics/ProcessingException.js';
import type { Coprocessor1 } from '../hardware/registers/Coprocessor1.js';
import type { Memory } from '../hardware/memory/Memory.js';
import type { RegisterFile } from '../hardware/registers/RegisterFile.js';
import type { SystemIO } from '../io/SystemIO.js';
import type { RandomStreams } from './random/RandomStreams.js';
import type { DialogIO } from '../io/DialogIO.js';
import type { ToneGenerator } from './midi/ToneGenerator.js';

/** Hardware and GUI console services owned by the machine running this service. */
export interface SyscallHost {
  /** Session integer registers. */
  readonly registerFile: RegisterFile;
  /** Session raw floating registers. */
  readonly coprocessor1: Coprocessor1;
  /** Session memory. */
  readonly memory: Memory<ProgramStatement>;
  /** Injected console and floating runtime services. */
  readonly systemIO: SystemIO;
  /** Session-local Java random stream collection. */
  readonly randomStreams: RandomStreams;
  /** Injected asynchronous dialog capability. */
  readonly dialogs: DialogIO;
  /** Session tone service delegating MIDI output to an optional sound host. */
  readonly toneGenerator: ToneGenerator;
  /** Session exception-register updates and current PC. */
  readonly exceptionHost: ProcessingExceptionHost;
}
