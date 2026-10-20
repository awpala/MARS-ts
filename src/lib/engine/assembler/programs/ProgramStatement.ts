/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/ProgramStatement.java; see MARSlicense.txt. */
import { ErrorList } from '../../diagnostics/ErrorList.js';
import { ErrorMessage, type DiagnosticProgram } from '../../diagnostics/ErrorMessage.js';
import { Binary } from '../../formatting/Binary.js';
import type { Coprocessor1 } from '../../hardware/registers/Coprocessor1.js';
import type { RegisterFile } from '../../hardware/registers/RegisterFile.js';
import { BasicInstruction } from '../../instructions/BasicInstruction.js';
import { BasicInstructionFormat } from '../../instructions/BasicInstructionFormat.js';
import { Instruction } from '../../instructions/Instruction.js';
import { SymbolTable } from '../symbols/SymbolTable.js';
import type { TokenList } from '../tokenization/TokenList.js';
import { TokenTypes } from '../tokenization/TokenTypes.js';

/** Program services needed for source mapping and resolving statement symbols. */
export interface StatementProgram extends DiagnosticProgram {
	/** The owning program's local/global symbol lookup. */
	getLocalSymbolTable(): Pick<SymbolTable, 'getAddressLocalOrGlobal'> | null;
}
/** Session-owned instruction lookup, registers, and display preferences. */
export interface ProgramStatementHost {
	/** Decode with the actual instruction set's mask matching algorithm. */
	findByBinaryCode(binary: number): BasicInstruction<ProgramStatement> | null;
	/** Look up actual instruction definitions, including the zero-word fallback. */
	matchOperator(name: string): readonly Instruction[] | null;
	/** General-purpose register lookup services. */
	registerFile: Pick<RegisterFile, 'getUserRegister' | 'getNumber'>;
	/** Floating-point register lookup services. */
	coprocessor1: Pick<Coprocessor1, 'getRegisterNumber'>;
	/** Whether address operands currently display in hexadecimal. */
	getDisplayAddressesInHex(): boolean;
	/** Whether immediate operands currently display in hexadecimal. */
	getDisplayValuesInHex(): boolean;
}
type StatementElement =
	{ type: 'string'; value: string } | { type: 'address' | 'value'; value: number };

/** Source, operands, machine encoding, and display representation of one instruction. */
export class ProgramStatement {
	private sourceMIPSprogram: StatementProgram | null;
	private source: string;
	private originalTokenList: TokenList | null;
	private strippedTokenList: TokenList | null;
	private instruction: Instruction | null;
	private textAddress: number;
	private sourceLine = 0;
	private operands: number[] | null;
	private numOperands = 0;
	private binaryStatement = 0;
	private basicAssemblyStatement: string | null = null;
	private machineStatement: string | null = null;
	private basicStatementList: StatementElement[] = [];
	private readonly host: ProgramStatementHost;

	/** Construct a statement from source and its matched instruction definition. */
	constructor(
		program: StatementProgram | null,
		source: string,
		original: TokenList,
		stripped: TokenList,
		instruction: Instruction | null,
		address: number,
		line: number,
		host: ProgramStatementHost
	);
	/** Decode an existing machine word, including self-modifying text. */
	constructor(binary: number, address: number, host: ProgramStatementHost);
	constructor(
		first: StatementProgram | number | null,
		second: string | number,
		third: TokenList | ProgramStatementHost,
		stripped?: TokenList,
		instruction?: Instruction | null,
		address?: number,
		line?: number,
		host?: ProgramStatementHost
	) {
		if (typeof first !== 'number') {
			this.sourceMIPSprogram = first;
			this.source = second as string;
			this.originalTokenList = third as TokenList;
			this.strippedTokenList = stripped!;
			this.instruction = instruction!;
			this.textAddress = address! | 0;
			this.sourceLine = line! | 0;
			this.operands = [0, 0, 0, 0];
			this.host = host!;
			return;
		}
		this.host = third as ProgramStatementHost;
		this.sourceMIPSprogram = null;
		this.binaryStatement = first | 0;
		this.textAddress = (second as number) | 0;
		this.originalTokenList = this.strippedTokenList = null;
		this.source = '';
		const decoded = this.host.findByBinaryCode(this.binaryStatement);
		if (decoded === null) {
			this.operands = null;
			this.instruction = this.binaryStatement === 0 ? this.host.matchOperator('nop')![0] : null;
		} else {
			this.operands = [0, 0, 0, 0];
			this.instruction = decoded;
			const mask = decoded.getOperationMask();
			const format = decoded.getInstructionFormat();
			for (const code of 'fst') {
				const start = mask.indexOf(code);
				if (start < 0) continue;
				const low = 31 - mask.lastIndexOf(code);
				const high = 31 - start;
				let operand = (this.binaryStatement >> low) & ((1 << (high - low + 1)) - 1);
				if (format === BasicInstructionFormat.I_BRANCH_FORMAT && this.numOperands === 2)
					operand = (operand << 16) >> 16;
				else if (format === BasicInstructionFormat.J_FORMAT && this.numOperands === 0)
					operand |= (this.textAddress >> 2) & 0x3c000000;
				this.operands[this.numOperands++] = operand;
			}
		}
		this.buildBasicStatementListFromBinaryCode(decoded);
	}

	/** Resolve named registers and symbols, retaining display element categories. */
	buildBasicStatementFromBasicInstruction(errors: ErrorList): void {
		const tokens = this.strippedTokenList!;
		let basic = tokens.get(0).getValue() + ' ';
		this.addString(basic);
		this.numOperands = 0;
		for (let index = 1; index < tokens.size(); index++) {
			const token = tokens.get(index);
			const type = token.getType();
			const value = token.getValue();
			const error = (message: string) =>
				errors.add(
					new ErrorMessage(
						this.sourceMIPSprogram,
						token.getSourceLine(),
						token.getStartPos(),
						message
					)
				);
			if (type === TokenTypes.REGISTER_NUMBER) {
				basic += value;
				this.addString(value);
				let number: number;
				try {
					number = this.host.registerFile.getUserRegister(value)!.getNumber();
				} catch {
					error('invalid register name');
					return;
				}
				this.addOperand(number);
			} else if (type === TokenTypes.REGISTER_NAME || type === TokenTypes.FP_REGISTER_NAME) {
				const fp = type === TokenTypes.FP_REGISTER_NAME;
				const number = fp
					? this.host.coprocessor1.getRegisterNumber(value)
					: this.host.registerFile.getNumber(value);
				const element = (fp ? '$f' : '$') + number;
				basic += element;
				this.addString(element);
				if (number < 0) {
					error(fp ? 'invalid FPU register name' : 'invalid register name');
					return;
				}
				this.addOperand(number);
			} else if (type === TokenTypes.IDENTIFIER) {
				let address = this.sourceMIPSprogram!.getLocalSymbolTable()!.getAddressLocalOrGlobal(value);
				if (address === SymbolTable.NOT_FOUND) {
					error(`Symbol "${value}" not found in symbol table.`);
					return;
				}
				let absolute = true;
				if (
					this.instruction instanceof BasicInstruction &&
					this.instruction.getInstructionFormat() === BasicInstructionFormat.I_BRANCH_FORMAT
				) {
					address = (address - (this.textAddress + Instruction.INSTRUCTION_LENGTH)) >> 2;
					absolute = false;
				}
				basic += address;
				this.basicStatementList.push({ type: absolute ? 'address' : 'value', value: address });
				this.addOperand(address);
			} else if (TokenTypes.isIntegerTokenType(type)) {
				const number = Binary.stringToInt(value);
				basic += number;
				this.basicStatementList.push({ type: 'value', value: number });
				this.addOperand(number);
			} else {
				basic += value;
				this.addString(value);
			}
			if (
				index < tokens.size() - 1 &&
				!this.isParenthesis(type) &&
				!this.isParenthesis(tokens.get(index + 1).getType())
			) {
				basic += ',';
				this.addString(',');
			}
		}
		this.basicAssemblyStatement = basic;
	}
	/** Insert operands into the canonical f/s/t mask, preserving branch/jump rules. */
	buildMachineStatementFromBasicStatement(errors: ErrorList): void {
		if (this.instruction !== null && !(this.instruction instanceof BasicInstruction)) {
			this.addError(
				errors,
				'INTERNAL ERROR: pseudo-instruction expansion contained a pseudo-instruction'
			);
			return;
		}
		const instruction = this.instruction as BasicInstruction<ProgramStatement>;
		this.machineStatement = instruction.getOperationMask();
		const format = instruction.getInstructionFormat();
		if (format === BasicInstructionFormat.J_FORMAT) {
			if ((this.textAddress & 0xf0000000) !== (this.operands![0] & 0xf0000000)) {
				this.addError(errors, 'Jump target word address beyond 26-bit range');
				return;
			}
			this.operands![0] >>>= 2;
			this.insertBinaryCode(this.operands![0], Instruction.operandMask[0], errors);
		} else if (format === BasicInstructionFormat.I_BRANCH_FORMAT) {
			for (let i = 0; i < this.numOperands - 1; i++)
				this.insertBinaryCode(this.operands![i], this.operandMask(i), errors);
			if (this.numOperands === 0) throw new RangeError('Operand index out of bounds');
			this.insertBinaryCode(
				this.operands![this.numOperands - 1],
				this.operandMask(this.numOperands - 1),
				errors
			);
		} else {
			for (let i = 0; i < this.numOperands; i++)
				this.insertBinaryCode(this.operands![i], this.operandMask(i), errors);
		}
		this.binaryStatement = Binary.binaryStringToInt(this.machineStatement);
	}
	/** Legacy diagnostic representation with signed hexadecimal operands and bit fields. */
	toString(): string {
		const blanks = '                               ';
		let result = `[${this.textAddress}]`;
		if (this.basicAssemblyStatement !== null) {
			const space = this.basicAssemblyStatement.indexOf(' ');
			result +=
				this.substring(blanks, 0, 16 - result.length) +
				this.substring(this.basicAssemblyStatement, 0, space);
			result +=
				this.substring(blanks, 0, 24 - result.length) +
				this.substring(this.basicAssemblyStatement, space + 1);
		} else
			result +=
				this.substring(blanks, 0, 16 - result.length) + '0x' + this.binaryStatement.toString(16);
		result += this.substring(blanks, 0, 40 - result.length) + ';  ';
		if (this.operands !== null)
			for (let i = 0; i < this.numOperands; i++) result += this.operands[i].toString(16) + ' ';
		if (this.machineStatement !== null) {
			const machine = this.machineStatement;
			result += `[${Binary.binaryStringToHexString(machine)}]  ${this.substring(machine, 0, 6)}|${this.substring(machine, 6, 11)}|${this.substring(machine, 11, 16)}|${this.substring(machine, 16, 21)}|${this.substring(machine, 21, 26)}|${this.substring(machine, 26, 32)}`;
		}
		return result;
	}
	/** Replace the basic assembly string without rebuilding the display list. */
	setBasicAssemblyStatement(statement: string | null): void {
		this.basicAssemblyStatement = statement;
	}
	/** Replace the machine bit string without decoding it. */
	setMachineStatement(statement: string | null): void {
		this.machineStatement = statement;
	}
	/** Replace the encoded signed machine word. */
	setBinaryStatement(binary: number): void {
		this.binaryStatement = binary | 0;
	}
	/** Replace the original source text. */
	setSource(source: string): void {
		this.source = source;
	}
	/** Owning program, or null for a decoded machine word. */
	getSourceMIPSprogram(): StatementProgram | null {
		return this.sourceMIPSprogram;
	}
	/** Owning filename, or empty for a decoded machine word. */
	getSourceFile(): string | null {
		return this.sourceMIPSprogram === null ? '' : this.sourceMIPSprogram.getFilename();
	}
	/** Original source text. */
	getSource(): string {
		return this.source;
	}
	/** Original one-based source line, or zero for a decoded machine word. */
	getSourceLine(): number {
		return this.sourceLine;
	}
	/** Built basic statement, or null before source assembly. */
	getBasicAssemblyStatement(): string | null {
		return this.basicAssemblyStatement;
	}
	/** Render retained elements using the current session display preferences. */
	getPrintableBasicAssemblyStatement(): string {
		const addressesHex = this.host.getDisplayAddressesInHex();
		const valuesHex = this.host.getDisplayValuesInHex();
		return this.basicStatementList
			.map((element) =>
				element.type === 'string'
					? element.value
					: (element.type === 'address' ? addressesHex : valuesHex)
						? Binary.intToHexString(element.value)
						: String(element.value)
			)
			.join('');
	}
	/** Built machine bit string, or null until encoding. */
	getMachineStatement(): string | null {
		return this.machineStatement;
	}
	/** Encoded machine word. */
	getBinaryStatement(): number {
		return this.binaryStatement;
	}
	/** Original tokens, retained by reference. */
	getOriginalTokenList(): TokenList | null {
		return this.originalTokenList;
	}
	/** Tokens after labels/comments were stripped, retained by reference. */
	getStrippedTokenList(): TokenList | null {
		return this.strippedTokenList;
	}
	/** Matched instruction definition, or null for an unknown word. */
	getInstruction(): Instruction | null {
		return this.instruction;
	}
	/** Text segment address. */
	getAddress(): number {
		return this.textAddress;
	}
	/** Mutable four-slot operand array, or null for an unknown word. */
	getOperands(): number[] | null {
		return this.operands;
	}
	/** Operand value, or -1 outside the populated portion of the array. */
	getOperand(index: number): number {
		return index >= 0 && index < this.numOperands ? this.operands![index] : -1;
	}

	private addString(value: string): void {
		this.basicStatementList.push({ type: 'string', value });
	}
	private addOperand(value: number): void {
		const index = this.numOperands++;
		if (index >= 4) throw new RangeError('Operand index out of bounds');
		this.operands![index] = value;
	}
	private operandMask(index: number): string {
		if (index < 0 || index >= Instruction.operandMask.length)
			throw new RangeError('Operand mask index out of bounds');
		return Instruction.operandMask[index];
	}
	private isParenthesis(type: TokenTypes): boolean {
		return type === TokenTypes.LEFT_PAREN || type === TokenTypes.RIGHT_PAREN;
	}
	private addError(errors: ErrorList, message: string): void {
		errors.add(new ErrorMessage(this.sourceMIPSprogram, this.sourceLine, 0, message));
	}
	private insertBinaryCode(value: number, mask: string, errors: ErrorList): void {
		const machine = this.machineStatement!;
		const start = machine.indexOf(mask),
			end = machine.lastIndexOf(mask);
		if (start < 0 || end < 0) {
			this.addError(errors, 'INTERNAL ERROR: mismatch in number of operands in statement vs mask');
			return;
		}
		this.machineStatement =
			machine.substring(0, start) +
			Binary.intToBinaryString(value, end - start + 1) +
			machine.substring(end + 1);
	}
	private substring(value: string, start: number, end = value.length): string {
		if (start < 0 || end > value.length || end < start)
			throw new RangeError('String index out of bounds');
		return value.substring(start, end);
	}
	private buildBasicStatementListFromBinaryCode(
		instruction: BasicInstruction<ProgramStatement> | null
	): void {
		if (instruction === null) {
			this.addString('<INVALID>');
			return;
		}
		this.addString(instruction.getName() + ' ');
		const tokens = instruction.getTokenList()!;
		let counter = 1;
		for (let i = 0; i < this.numOperands; i++) {
			if (
				counter > 1 &&
				counter < tokens.size() &&
				!this.isParenthesis(tokens.get(counter).getType())
			)
				this.addString(',');
			let notOperand = true;
			while (notOperand && counter < tokens.size()) {
				const type = tokens.get(counter).getType();
				if (type === TokenTypes.LEFT_PAREN) this.addString('(');
				else if (type === TokenTypes.RIGHT_PAREN) this.addString(')');
				else if (type.toString().includes('REGISTER')) {
					this.addString(
						(type.toString().includes('FP_REGISTER') ? '$f' : '$') + this.operands![i]
					);
					notOperand = false;
				} else {
					this.basicStatementList.push({ type: 'value', value: this.operands![i] });
					notOperand = false;
				}
				counter++;
			}
		}
		while (counter < tokens.size()) {
			const type = tokens.get(counter++).getType();
			if (type === TokenTypes.LEFT_PAREN) this.addString('(');
			else if (type === TokenTypes.RIGHT_PAREN) this.addString(')');
		}
	}
}
