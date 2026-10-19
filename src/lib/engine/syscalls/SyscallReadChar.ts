/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallReadChar.java; see MARSlicense.txt. */
import { AbstractSyscall, type SyscallHost } from './AbstractSyscall.js';
import type { ProgramStatement } from '../assembler/ProgramStatement.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';
import { Exceptions } from '../simulator/Exceptions.js';
/** Canonical ReadChar service; hardware and I/O remain owned by the injected session. */
export class SyscallReadChar extends AbstractSyscall {
	/** Construct service 12 (ReadChar) for this session. */
	constructor(host: SyscallHost) {
		super(12, 'ReadChar', host);
	}
	/** Execute the canonical register, memory, console, and error behavior. */
	override async simulate(statement: ProgramStatement): Promise<void> {
		let value: number;
		try {
			value = await this.host.systemIO.readChar(this.getNumber());
		} catch (error) {
			if (!(error instanceof RangeError)) throw error;
			throw new ProcessingException(
				statement,
				`invalid char input (syscall ${this.getNumber()})`,
				this.host.exceptionHost,
				Exceptions.SYSCALL_EXCEPTION
			);
		}
		this.host.registerFile.updateRegister(2, value);
	}
}
