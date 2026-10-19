/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallPrintIntBinary.java; see MARSlicense.txt. */
import { AbstractSyscall, type SyscallHost } from './AbstractSyscall.js';
import { Binary } from '../formatting/Binary.js';
/** Canonical PrintIntBinary service; hardware and I/O remain owned by the injected session. */
export class SyscallPrintIntBinary extends AbstractSyscall {
	/** Construct service 35 (PrintIntBinary) for this session. */
	constructor(host: SyscallHost) {
		super(35, 'PrintIntBinary', host);
	}
	/** Execute the canonical register, memory, console, and error behavior. */
	override simulate(): void {
		this.host.systemIO.printString(Binary.intToBinaryString(this.host.registerFile.getValue(4)));
	}
}
