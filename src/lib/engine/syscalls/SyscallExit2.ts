/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallExit2.java; see MARSlicense.txt. */
import { AbstractSyscall, type SyscallHost } from './AbstractSyscall.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';
/** GUI Exit2 ignores $a0 and terminates normally, as in the canonical Swing implementation. */
export class SyscallExit2 extends AbstractSyscall {
	/** Construct service 17 (Exit2) for this session. */
	constructor(host: SyscallHost) {
		super(17, 'Exit2', host);
	}
	/** Execute the canonical register, memory, console, and error behavior. */
	override simulate(): void {
		throw new ProcessingException();
	}
}
