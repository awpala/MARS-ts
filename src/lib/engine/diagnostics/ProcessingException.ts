/*
 * Copyright (c) 2003–2006 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/ProcessingException.java. See MARSlicense.txt at the repository root.
 */
import { Binary } from '../formatting/Binary.js';
import { AddressErrorException } from '../hardware/AddressErrorException.js';
import { ErrorList } from './ErrorList.js';
import { ErrorMessage, type DiagnosticStatement } from './ErrorMessage.js';

/** The owning machine supplies PC reads and exception-register writes, replacing Java globals. */
export interface ProcessingExceptionHost {
	/** Read the already-incremented program counter with the register's ordinary read notice. */
	getProgramCounter(): number;
	/** Write cause, optional bad address, EPC, and status through the session's Exceptions instance. */
	setRegisters(cause: number, address?: number): void;
}

/** Assembly/runtime failure or normal exit sentinel; ports mars/ProcessingException.java. */
export class ProcessingException extends Error {
	private readonly errs: ErrorList | null;

	/** No diagnostic list means normal termination, as used by the exit syscall. */
	constructor();
	/** Retain the supplied diagnostic list without copying it. */
	constructor(errors: ErrorList);
	/** Retain diagnostics and update address-exception registers on the supplied session. */
	constructor(errors: ErrorList, address: AddressErrorException, host: ProcessingExceptionHost);
	/** Report a runtime failure at PC minus four, optionally updating its exception cause. */
	constructor(
		statement: DiagnosticStatement,
		message: string,
		host: ProcessingExceptionHost,
		cause?: number
	);
	/** Report a runtime address failure and update the supplied session's exception registers. */
	constructor(
		statement: DiagnosticStatement,
		address: AddressErrorException,
		host: ProcessingExceptionHost
	);
	constructor(
		source?: ErrorList | DiagnosticStatement,
		message?: string | AddressErrorException,
		host?: ProcessingExceptionHost,
		cause?: number
	) {
		super();
		this.name = 'ProcessingException';
		if (source === undefined) {
			this.errs = null;
			return;
		}
		if (source instanceof ErrorList) this.errs = source;
		else {
			if (!host) throw new TypeError('A runtime exception requires its owning machine');
			this.errs = new ErrorList();
			this.errs.add(
				new ErrorMessage(
					source,
					`Runtime exception at ${Binary.intToHexString((host.getProgramCounter() - 4) | 0)}: ${message instanceof AddressErrorException ? message.message : message}`
				)
			);
		}
		if (message instanceof AddressErrorException) {
			if (!host) throw new TypeError('An address exception requires its owning machine');
			host.setRegisters(message.getType(), message.getAddress());
		} else if (cause !== undefined) {
			if (!host) throw new TypeError('An exception cause requires its owning machine');
			host.setRegisters(cause);
		}
	}

	/** Return the owned/reference diagnostic list, or null for normal program termination. */
	errors(): ErrorList | null {
		return this.errs;
	}
}
