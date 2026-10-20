/*
 * Copyright (c) 2003–2012 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/ErrorList.java. See MARSlicense.txt at the repository root.
 */
import { ErrorMessage } from './ErrorMessage.js';

/** Session-owned diagnostics and exact report ordering; ports mars/ErrorList.java. */
export class ErrorList {
	/** Error report prefix. */
	static readonly ERROR_MESSAGE_PREFIX = 'Error';
	/** Warning report prefix. */
	static readonly WARNING_MESSAGE_PREFIX = 'Warning';
	/** Filename separator, retained even with an empty filename. */
	static readonly FILENAME_PREFIX = ' in ';
	/** Source line separator. */
	static readonly LINE_PREFIX = ' line ';
	/** Source column separator. */
	static readonly POSITION_PREFIX = ' column ';
	/** Location/message separator. */
	static readonly MESSAGE_SEPARATOR = ': ';
	private readonly messages: ErrorMessage[] = [];
	private errors = 0;
	private warnings = 0;

	/** Inject the owning session's error limit; defaults to Globals.maximumErrorMessages. */
	constructor(private readonly maximumErrorMessages = 200) {}

	/** Return the list owned by this instance, as in Java; mutation does not update counters. */
	getErrorMessages(): ErrorMessage[] {
		return this.messages;
	}
	/** Whether errors, excluding warnings, have been recorded. */
	errorsOccurred(): boolean {
		return this.errors !== 0;
	}
	/** Whether warnings have been recorded. */
	warningsOccurred(): boolean {
		return this.warnings !== 0;
	}
	/** Insert a diagnostic; one terminal error is appended when the error limit is reached. */
	add(message: ErrorMessage, index = this.messages.length): void {
		if (this.errors > this.getErrorLimit()) return;
		if (this.errors === this.getErrorLimit()) {
			this.messages.push(
				new ErrorMessage(
					null,
					message.getLine(),
					message.getPosition(),
					`Error Limit of ${this.getErrorLimit()} exceeded.`
				)
			);
			this.errors++;
			return;
		}
		if (!Number.isInteger(index) || index < 0 || index > this.messages.length)
			throw new RangeError('Diagnostic index out of bounds');
		this.messages.splice(index, 0, message);
		if (message.isWarning()) this.warnings++;
		else this.errors++;
	}
	/** Number of errors, including the terminal error-limit diagnostic. */
	errorCount(): number {
		return this.errors;
	}
	/** Number of warnings. */
	warningCount(): number {
		return this.warnings;
	}
	/** Whether the extra terminal error-limit diagnostic has been generated. */
	errorLimitExceeded(): boolean {
		return this.errors > this.getErrorLimit();
	}
	/** Maximum ordinary errors for this list's owning session. */
	getErrorLimit(): number {
		return this.maximumErrorMessages;
	}
	/** Error-only report with a newline after each diagnostic. */
	generateErrorReport(): string {
		return this.generateReport(ErrorMessage.ERROR);
	}
	/** Warning-only report with a newline after each diagnostic. */
	generateWarningReport(): string {
		return this.generateReport(ErrorMessage.WARNING);
	}
	/** Combined report with all warnings first, preserving each group's insertion order. */
	generateErrorAndWarningReport(): string {
		return this.generateWarningReport() + this.generateErrorReport();
	}

	private generateReport(warning: boolean): string {
		let report = '';
		for (const message of this.messages) {
			if (message.isWarning() !== warning) continue;
			let line =
				(warning ? ErrorList.WARNING_MESSAGE_PREFIX : ErrorList.ERROR_MESSAGE_PREFIX) +
				ErrorList.FILENAME_PREFIX;
			// java.io.File.getPath on the Linux oracle collapses repeated separators and trailing slashes.
			const filename = message.getFilename();
			if (filename === null) throw new TypeError('Null diagnostic filename');
			const path = filename.replace(/\/{2,}/g, '/');
			line += path.length > 1 ? path.replace(/\/$/, '') : path;
			if (message.getLine() > 0)
				line += ErrorList.LINE_PREFIX + message.getMacroExpansionHistory() + message.getLine();
			if (message.getPosition() > 0) line += ErrorList.POSITION_PREFIX + message.getPosition();
			report += line + ErrorList.MESSAGE_SEPARATOR + message.getMessage() + '\n';
		}
		return report;
	}
}
