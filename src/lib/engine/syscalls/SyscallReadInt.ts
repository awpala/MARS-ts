/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/SyscallReadInt.java; see MARSlicense.txt. */
import { AbstractSyscall, type SyscallHost } from './AbstractSyscall.js';
import type { ProgramStatement } from '../assembler/ProgramStatement.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';
import { Exceptions } from '../simulator/Exceptions.js';
import { NumberFormatException } from '../formatting/Binary.js';
/** Canonical ReadInt service; hardware and I/O remain owned by the injected session. */
export class SyscallReadInt extends AbstractSyscall {
	/** Construct service 5 (ReadInt) for this session. */
	constructor(host: SyscallHost) {
		super(5, 'ReadInt', host);
	}
	/** Execute the canonical register, memory, console, and error behavior. */
	override async simulate(statement: ProgramStatement): Promise<void> {
		let value: number;
		try {
			value = await this.host.systemIO.readInteger(this.getNumber());
		} catch (error) {
			if (!(error instanceof NumberFormatException)) throw error;
			throw new ProcessingException(
				statement,
				`invalid integer input (syscall ${this.getNumber()})`,
				this.host.exceptionHost,
				Exceptions.SYSCALL_EXCEPTION
			);
		}
		this.host.registerFile.updateRegister(2, value);
	}
}
