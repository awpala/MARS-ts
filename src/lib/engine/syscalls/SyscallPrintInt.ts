/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallPrintInt.java; see MARSlicense.txt. */
import { AbstractSyscall, type SyscallHost } from './AbstractSyscall.js';
/** Canonical PrintInt service; hardware and I/O remain owned by the injected session. */
export class SyscallPrintInt extends AbstractSyscall {
	/** Construct service 1 (PrintInt) for this session. */
	constructor(host: SyscallHost) {
		super(1, 'PrintInt', host);
	}
	/** Execute the canonical register, memory, console, and error behavior. */
	override simulate(): void {
		this.host.systemIO.printString(String(this.host.registerFile.getValue(4)));
	}
}
