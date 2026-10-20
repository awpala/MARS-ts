/* Copyright (c) 2003–2006 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/Instruction.java; see MARSlicense.txt. */
import { TokenList } from '../assembler/tokenization/TokenList.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';

/** Tokenizer and configuration-output services owned by the instruction set's session. */
export interface InstructionHost {
	/** Tokenize with a fresh canonical Tokenizer per call, so configuration errors cannot poison later examples. */
	tokenizeExampleInstruction(example: string): TokenList;
	/** Emit configuration diagnostics through the owning host's output channel. */
	write(message: string): void;
}

/** Shared instruction metadata and example tokenization; ports the Java abstract base class. */
export abstract class Instruction {
	/** Size of a MIPS machine instruction in bytes. */
	static readonly INSTRUCTION_LENGTH = 4;
	/** Size of a MIPS machine instruction in bits. */
	static readonly INSTRUCTION_LENGTH_BITS = 32;
	/** First, second, and third operand-mask characters in source order. */
	static readonly operandMask = Object.freeze(['f', 's', 't']);
	protected mnemonic: string;
	protected tokenList: TokenList | null = null;

	/** Retain example, description, and the owning instruction set's injected services. */
	protected constructor(
		protected readonly exampleFormat: string,
		protected readonly description: string,
		protected readonly host: InstructionHost
	) {
		this.mnemonic = this.extractOperator(exampleFormat);
	}
	/** Operator mnemonic extracted from the example. */
	getName(): string {
		return this.mnemonic;
	}
	/** Canonical example assembly syntax, including operand placeholders. */
	getExampleFormat(): string {
		return this.exampleFormat;
	}
	/** User-facing instruction description. */
	getDescription(): string {
		return this.description;
	}
	/** Tokenized example, or null before instruction-set initialization. */
	getTokenList(): TokenList | null {
		return this.tokenList;
	}
	/** Size of this instruction's machine representation; extended instructions override it. */
	getInstructionLength(): number {
		return Instruction.INSTRUCTION_LENGTH;
	}
	/** Initialize the example tokens, retaining Java's configuration-error recovery. */
	createExampleTokenList(): void {
		try {
			this.tokenList = this.host.tokenizeExampleInstruction(this.exampleFormat);
		} catch (error) {
			if (!(error instanceof ProcessingException)) throw error;
			this.host.write(
				`CONFIGURATION ERROR: Instruction example "${this.exampleFormat}" contains invalid token(s).\n`
			);
		}
	}
	protected extractOperator(example: string): string {
		const first = example.split(/[ ,\t]+/).find((token) => token.length !== 0);
		if (first === undefined) throw new RangeError('NoSuchElementException');
		return first;
	}
}
