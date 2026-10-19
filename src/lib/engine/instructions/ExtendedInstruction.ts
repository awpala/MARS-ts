/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/ExtendedInstruction.java; see MARSlicense.txt. */
import { Instruction, type InstructionHost } from './Instruction.js';
import type { TokenList } from '../assembler/TokenList.js';
import type { SymbolTable } from '../assembler/SymbolTable.js';
import type { RegisterFile } from '../hardware/RegisterFile.js';
import type { Coprocessor1 } from '../hardware/Coprocessor1.js';
import { Binary, NumberFormatException } from '../formatting/Binary.js';

/** Session-owned settings and example tokenizer used by pseudo-instruction descriptors. */
export interface ExtendedInstructionHost extends InstructionHost {
	/** Return the current delayed-branch setting, including changes after construction. */
	getDelayedBranchingEnabled(): boolean;
}
/** Program symbol lookup consumed by the original LAB expansion. */
export interface ExtendedInstructionProgram {
	/** Resolve local symbols with the original global fallback. */
	getLocalSymbolTable(): Pick<SymbolTable, 'getSymbolGivenAddressLocalOrGlobal'> | null;
}
/** Actual session register banks and settings consumed by template expansion. */
export interface ExtendedInstructionContext {
	/** Integer register lookup used by NR markers. */
	registerFile: Pick<RegisterFile, 'getUserRegister'>;
	/** Floating-point register lookup used by NR markers. */
	coprocessor1: Pick<Coprocessor1, 'getRegisterNumber'>;
	/** Current delayed-branch mode. */
	getDelayedBranchingEnabled(): boolean;
}

/** Canonical pseudo-instruction metadata and ordered basic-instruction template substitution. */
export class ExtendedInstruction extends Instruction {
	private readonly translationStrings: string[] | null;
	private readonly compactTranslationStrings: string[] | null;
	private readonly extendedHost: ExtendedInstructionHost;

	/** Construct a definition without description or compact alternative. */
	constructor(example: string, translation: string | null, host: ExtendedInstructionHost);
	/** Construct a described definition without a compact alternative. */
	constructor(
		example: string,
		translation: string | null,
		description: string,
		host: ExtendedInstructionHost
	);
	/** Construct a described definition with an optional compact alternative. */
	constructor(
		example: string,
		translation: string | null,
		compactTranslation: string | null,
		description: string,
		host: ExtendedInstructionHost
	);
	constructor(
		example: string,
		translation: string | null,
		third: string | null | ExtendedInstructionHost,
		fourth?: string | ExtendedInstructionHost,
		fifth?: ExtendedInstructionHost
	) {
		const host =
			fifth ?? (typeof fourth === 'object' ? fourth : (third as ExtendedInstructionHost));
		const description =
			fifth !== undefined
				? (fourth as string)
				: typeof fourth === 'object'
					? (third as string)
					: '';
		const compact = fifth !== undefined ? (third as string | null) : null;
		super(example, description, host);
		this.extendedHost = host;
		this.createExampleTokenList();
		this.translationStrings = this.buildTranslationList(translation);
		this.compactTranslationStrings = this.buildTranslationList(compact);
	}
	/** Return normal expansion length, accounting for the current delayed-branch setting. */
	override getInstructionLength(): number {
		return this.translationLength(this.translationStrings);
	}
	/** Return the mutable normal templates; original Java spelling is retained. */
	getBasicIntructionTemplateList(): string[] | null {
		return this.translationStrings;
	}
	/** Return compact expansion length, or zero when no alternative exists. */
	getCompactInstructionLength(): number {
		return this.translationLength(this.compactTranslationStrings);
	}
	/** Report whether a compact template list exists, including an empty list. */
	hasCompactTranslation(): boolean {
		return this.compactTranslationStrings !== null;
	}
	/** Return the mutable compact templates; original Java spelling is retained. */
	getCompactBasicIntructionTemplateList(): string[] | null {
		return this.compactTranslationStrings;
	}

	/** Expand a verified statement whose registers and symbol addresses have been normalized by the assembler. */
	static makeTemplateSubstitutions(
		program: ExtendedInstructionProgram | null,
		template: string,
		theTokenList: TokenList,
		context: ExtendedInstructionContext
	): string {
		let instruction = template;
		let index: number;

		if (instruction.indexOf('DBNOP') >= 0) {
			return context.getDelayedBranchingEnabled() ? 'nop' : '';
		}

		for (let op = 1; op < theTokenList.size(); op++) {
			instruction = this.substitute(instruction, 'RG' + op, theTokenList.get(op).getValue());
			instruction = this.substitute(instruction, 'OP' + op, theTokenList.get(op).getValue());

			if ((index = instruction.indexOf('LH' + op + 'P')) >= 0) {
				const label = theTokenList.get(op).getValue();
				let addr = 0;
				const add = this.characterCodeAt(instruction, index + 4) - 48;
				try {
					addr = (Binary.stringToInt(label) + add) | 0;
				} catch (error) {
					if (!(error instanceof NumberFormatException)) throw error;
				}

				const extra = Binary.bitValue(addr, 15);
				instruction = this.substitute(
					instruction,
					'LH' + op + 'P' + add,
					String((addr >> 16) + extra)
				);
			}

			if (instruction.indexOf('LH' + op) >= 0) {
				const label = theTokenList.get(op).getValue();
				let addr = 0;
				try {
					addr = Binary.stringToInt(label) | 0;
				} catch (error) {
					if (!(error instanceof NumberFormatException)) throw error;
				}

				const extra = Binary.bitValue(addr, 15);
				instruction = this.substitute(instruction, 'LH' + op, String((addr >> 16) + extra));
			}

			if ((index = instruction.indexOf('LL' + op + 'P')) >= 0) {
				const label = theTokenList.get(op).getValue();
				let addr = 0;
				const add = this.characterCodeAt(instruction, index + 4) - 48;
				try {
					addr = (Binary.stringToInt(label) + add) | 0;
				} catch (error) {
					if (!(error instanceof NumberFormatException)) throw error;
				}
				instruction = this.substitute(
					instruction,
					'LL' + op + 'P' + add,
					String((addr << 16) >> 16)
				);
			}

			if ((index = instruction.indexOf('LL' + op)) >= 0) {
				const label = theTokenList.get(op).getValue();
				let addr = 0;
				try {
					addr = Binary.stringToInt(label) | 0;
				} catch (error) {
					if (!(error instanceof NumberFormatException)) throw error;
				}
				if (instruction.length > index + 3 && instruction.charAt(index + 3) == 'U') {
					instruction = this.substitute(instruction, 'LL' + op + 'U', String(addr & 0xffff));
				} else {
					instruction = this.substitute(instruction, 'LL' + op, String((addr << 16) >> 16));
				}
			}

			if ((index = instruction.indexOf('VHL' + op + 'P')) >= 0) {
				const value = theTokenList.get(op).getValue();
				let val = 0;
				const add = this.characterCodeAt(instruction, index + 5) - 48;
				try {
					val = (Binary.stringToInt(value) + add) | 0;
				} catch (error) {
					if (!(error instanceof NumberFormatException)) throw error;
				}
				instruction = this.substitute(instruction, 'VHL' + op + 'P' + add, String(val >> 16));
			}

			if ((index = instruction.indexOf('VH' + op + 'P')) >= 0) {
				const value = theTokenList.get(op).getValue();
				let val = 0;
				const add = this.characterCodeAt(instruction, index + 4) - 48;
				try {
					val = (Binary.stringToInt(value) + add) | 0;
				} catch (error) {
					if (!(error instanceof NumberFormatException)) throw error;
				}

				const extra = Binary.bitValue(val, 15);
				instruction = this.substitute(
					instruction,
					'VH' + op + 'P' + add,
					String((val >> 16) + extra)
				);
			}

			if (instruction.indexOf('VH' + op) >= 0) {
				const value = theTokenList.get(op).getValue();
				let val = 0;
				try {
					val = Binary.stringToInt(value) | 0;
				} catch (error) {
					if (!(error instanceof NumberFormatException)) throw error;
				}

				const extra = Binary.bitValue(val, 15);
				instruction = this.substitute(instruction, 'VH' + op, String((val >> 16) + extra));
			}

			if ((index = instruction.indexOf('VL' + op + 'P')) >= 0) {
				const value = theTokenList.get(op).getValue();
				let val = 0;
				const add = this.characterCodeAt(instruction, index + 4) - 48;
				try {
					val = (Binary.stringToInt(value) + add) | 0;
				} catch (error) {
					if (!(error instanceof NumberFormatException)) throw error;
				}
				if (instruction.length > index + 5 && instruction.charAt(index + 5) == 'U') {
					instruction = this.substitute(
						instruction,
						'VL' + op + 'P' + add + 'U',
						String(val & 0xffff)
					);
				} else {
					instruction = this.substitute(
						instruction,
						'VL' + op + 'P' + add,
						String((val << 16) >> 16)
					);
				}
			}

			if ((index = instruction.indexOf('VL' + op)) >= 0) {
				const value = theTokenList.get(op).getValue();
				let val = 0;
				try {
					val = Binary.stringToInt(value) | 0;
				} catch (error) {
					if (!(error instanceof NumberFormatException)) throw error;
				}
				if (instruction.length > index + 3 && instruction.charAt(index + 3) == 'U') {
					instruction = this.substitute(instruction, 'VL' + op + 'U', String(val & 0xffff));
				} else {
					instruction = this.substitute(instruction, 'VL' + op, String((val << 16) >> 16));
				}
			}

			if (instruction.indexOf('VHL' + op) >= 0) {
				const value = theTokenList.get(op).getValue();
				let val = 0;
				try {
					val = Binary.stringToInt(value) | 0;
				} catch (error) {
					if (!(error instanceof NumberFormatException)) throw error;
				}
				instruction = this.substitute(instruction, 'VHL' + op, String(val >> 16));
			}
		}

		if (instruction.indexOf('LHL') >= 0) {
			const label = theTokenList.get(2).getValue();
			let addr = 0;
			try {
				addr = Binary.stringToInt(label) | 0;
			} catch (error) {
				if (!(error instanceof NumberFormatException)) throw error;
			}
			instruction = this.substitute(instruction, 'LHL', String(addr >> 16));
		}

		if ((index = instruction.indexOf('LHPAP')) >= 0) {
			const label = theTokenList.get(2).getValue();
			const addend = theTokenList.get(4).getValue();
			let addr = 0;
			const add = this.characterCodeAt(instruction, index + 5) - 48;
			try {
				addr = (Binary.stringToInt(label) + Binary.stringToInt(addend) + add) | 0;
			} catch (error) {
				if (!(error instanceof NumberFormatException)) throw error;
			}

			const extra = Binary.bitValue(addr, 15);
			instruction = this.substitute(instruction, 'LHPAP' + add, String((addr >> 16) + extra));
		}

		if (instruction.indexOf('LHPA') >= 0) {
			const label = theTokenList.get(2).getValue();
			const addend = theTokenList.get(4).getValue();
			let addr = 0;
			try {
				addr = (Binary.stringToInt(label) + Binary.stringToInt(addend)) | 0;
			} catch (error) {
				if (!(error instanceof NumberFormatException)) throw error;
			}

			const extra = Binary.bitValue(addr, 15);
			instruction = this.substitute(instruction, 'LHPA', String((addr >> 16) + extra));
		}

		if (instruction.indexOf('LHPN') >= 0) {
			const label = theTokenList.get(2).getValue();
			const addend = theTokenList.get(4).getValue();
			let addr = 0;
			try {
				addr = (Binary.stringToInt(label) + Binary.stringToInt(addend)) | 0;
			} catch (error) {
				if (!(error instanceof NumberFormatException)) throw error;
			}
			instruction = this.substitute(instruction, 'LHPN', String(addr >> 16));
		}

		if ((index = instruction.indexOf('LLPP')) >= 0) {
			const label = theTokenList.get(2).getValue();
			const addend = theTokenList.get(4).getValue();
			let addr = 0;
			const add = this.characterCodeAt(instruction, index + 4) - 48;
			try {
				addr = (Binary.stringToInt(label) + Binary.stringToInt(addend) + add) | 0;
			} catch (error) {
				if (!(error instanceof NumberFormatException)) throw error;
			}
			instruction = this.substitute(instruction, 'LLPP' + add, String((addr << 16) >> 16));
		}

		if ((index = instruction.indexOf('LLP')) >= 0) {
			const label = theTokenList.get(2).getValue();
			const addend = theTokenList.get(4).getValue();
			let addr = 0;
			try {
				addr = (Binary.stringToInt(label) + Binary.stringToInt(addend)) | 0;
			} catch (error) {
				if (!(error instanceof NumberFormatException)) throw error;
			}
			if (instruction.length > index + 3 && instruction.charAt(index + 3) == 'U') {
				instruction = this.substitute(instruction, 'LLPU', String(addr & 0xffff));
			} else {
				instruction = this.substitute(instruction, 'LLP', String((addr << 16) >> 16));
			}
		}

		if ((index = instruction.indexOf('BROFF')) >= 0) {
			try {
				const disabled = this.substring(instruction, index + 5, index + 6);
				const enabled = this.substring(instruction, index + 6, index + 7);
				instruction = this.substitute(
					instruction,
					'BROFF' + disabled + enabled,
					context.getDelayedBranchingEnabled() ? enabled : disabled
				);
			} catch (error) {
				if (!(error instanceof RangeError)) throw error;
				instruction = this.substitute(instruction, 'BROFF', 'BAD_PSEUDO_OP_SPEC');
			}
		}

		if (instruction.indexOf('NR') >= 0) {
			for (let op = 1; op < theTokenList.size(); op++) {
				const token = theTokenList.get(op).getValue();
				const register = context.registerFile.getUserRegister(token);
				if (register !== null) {
					const regNumber = register.getNumber();
					if (regNumber >= 0)
						instruction = this.substitute(instruction, 'NR' + op, '$' + (regNumber + 1));
				} else {
					const regNumber = context.coprocessor1.getRegisterNumber(token);
					if (regNumber >= 0)
						instruction = this.substitute(instruction, 'NR' + op, '$f' + (regNumber + 1));
				}
			}
		}
		if (instruction.indexOf('S32') >= 0) {
			const value = theTokenList.get(theTokenList.size() - 1).getValue();
			let val = 0;
			try {
				val = Binary.stringToInt(value) | 0;
			} catch (error) {
				if (!(error instanceof NumberFormatException)) throw error;
			}
			instruction = this.substitute(instruction, 'S32', String((32 - val) | 0));
		}

		if (instruction.indexOf('LAB') >= 0) {
			const label = theTokenList.get(theTokenList.size() - 1).getValue();
			const sym = program!.getLocalSymbolTable()!.getSymbolGivenAddressLocalOrGlobal(label);
			if (sym != null) {
				instruction = this.substituteFirst(instruction, 'LAB', sym.getName());
			}
		}
		return instruction;
	}

	private static substitute(original: string, find: string, replacement: string): string {
		if (original.indexOf(find) < 0 || find === replacement) return original;
		let modified = original;
		let i: number;
		while ((i = modified.indexOf(find)) >= 0)
			modified = modified.substring(0, i) + replacement + modified.substring(i + find.length);
		return modified;
	}
	private static substituteFirst(original: string, find: string, replacement: string): string {
		if (original.indexOf(find) < 0 || find === replacement) return original;
		const i = original.indexOf(find);
		return original.substring(0, i) + replacement + original.substring(i + find.length);
	}
	private static characterCodeAt(value: string, index: number): number {
		if (index < 0 || index >= value.length) throw new RangeError('StringIndexOutOfBoundsException');
		return value.charCodeAt(index);
	}
	private static substring(value: string, start: number, end: number): string {
		if (start < 0 || end > value.length || start > end)
			throw new RangeError('StringIndexOutOfBoundsException');
		return value.substring(start, end);
	}
	private buildTranslationList(translation: string | null): string[] | null {
		if (translation === null || translation.length === 0) return null;
		return translation.split('\n').filter((token) => token.length !== 0);
	}
	private translationLength(translationList: string[] | null): number {
		if (translationList === null || translationList.length === 0) return 0;
		let count = 0;
		for (const template of translationList) {
			if (template.indexOf('DBNOP') >= 0 && !this.extendedHost.getDelayedBranchingEnabled())
				continue;
			count++;
		}
		return (4 * count) | 0;
	}
}
