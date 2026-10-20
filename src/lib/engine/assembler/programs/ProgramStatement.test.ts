import { describe, expect, it } from 'vitest';
import golden from '../../../../../tests/oracle/statement-units/golden.json';
import {
	ProgramStatement,
	type ProgramStatementHost,
	type StatementProgram
} from './ProgramStatement.js';
import { Token } from '../tokenization/Token.js';
import { TokenList } from '../tokenization/TokenList.js';
import { TokenTypes } from '../tokenization/TokenTypes.js';
import { BasicInstruction } from '../../instructions/BasicInstruction.js';
import { ExtendedInstruction } from '../../instructions/ExtendedInstruction.js';
import { BasicInstructionFormat } from '../../instructions/BasicInstructionFormat.js';
import { ErrorList } from '../../diagnostics/ErrorList.js';
import { RegisterFile } from '../../hardware/registers/RegisterFile.js';
import { Coprocessor1 } from '../../hardware/registers/Coprocessor1.js';

type TokenData = [string, string, number, number];
interface State {
	basic: string | null;
	machine: string | null;
	binary: number;
	operands: number[] | null;
	printable: string[];
	string: string;
	errors: string;
	bounds: number[];
}
interface Definition {
	kind: 'instruction';
	id: number;
	example: string;
	mask: string;
	format: 'R' | 'I' | 'B' | 'J';
	tokens: TokenData[];
}
interface Decode {
	kind: 'decode';
	id: number;
	binary: number;
	address: number;
	state: State;
}
interface Encode {
	kind: 'encode';
	id: number;
	tokens: TokenData[];
	address: number;
	symbol: number;
	label: string;
	repeat: boolean;
	state: State;
}
interface Special {
	kind: 'special';
	name: string;
	state: State;
	source: string;
	file: string | null;
	instruction: string | null;
}
const rows = golden.stdout
	.trimEnd()
	.split('\n')
	.map((line) => JSON.parse(line) as Definition | Decode | Encode | Special);
const types = TokenTypes as unknown as Record<string, TokenTypes>;
function tokens(data: TokenData[]): TokenList {
	const list = new TokenList();
	for (const [type, value, line, pos] of data)
		list.add(new Token(types[type], value, null, line, pos));
	return list;
}
const formats = {
	R: BasicInstructionFormat.R_FORMAT,
	I: BasicInstructionFormat.I_FORMAT,
	B: BasicInstructionFormat.I_BRANCH_FORMAT,
	J: BasicInstructionFormat.J_FORMAT
};
const definitions = rows.filter((row): row is Definition => row.kind === 'instruction');
function fixture() {
	let setting = 0;
	let decoded: BasicInstruction<ProgramStatement> | null = null;
	const instructions = definitions.map((row) => {
		const instruction = new BasicInstruction<ProgramStatement>(
			row.example,
			formats[row.format],
			row.mask,
			{
				simulate() {
					throw new Error('Metadata-only statement test must never execute');
				}
			},
			{
				tokenizeExampleInstruction: () => tokens(row.tokens),
				write: () => {
					throw new Error('Unexpected descriptor diagnostic');
				}
			}
		);
		instruction.createExampleTokenList();
		return instruction;
	});
	const host: ProgramStatementHost = {
		findByBinaryCode: () => decoded,
		matchOperator: (name) => instructions.filter((i) => i.getName() === name),
		registerFile: new RegisterFile(),
		coprocessor1: new Coprocessor1(),
		getDisplayAddressesInHex: () => Boolean(setting & 1),
		getDisplayValuesInHex: () => Boolean(setting & 2)
	};
	function state(statement: ProgramStatement, errors: ErrorList): State {
		const printable = [];
		for (setting = 0; setting < 4; setting++)
			printable.push(statement.getPrintableBasicAssemblyStatement());
		let string: string;
		try {
			string = statement.toString();
		} catch {
			string = '<THROWS>';
		}
		return {
			basic: statement.getBasicAssemblyStatement(),
			machine: statement.getMachineStatement(),
			binary: statement.getBinaryStatement(),
			operands: statement.getOperands(),
			printable,
			string,
			errors: errors.generateErrorReport(),
			bounds: [-1, 0, 1, 2, 3, 4].map((i) => statement.getOperand(i))
		};
	}
	return {
		host,
		instructions,
		state,
		setDecoded: (id: number) => {
			decoded = instructions[id] ?? null;
		}
	};
}
describe('ProgramStatement Java oracle', () => {
	it('decodes all canonical basic masks, operand extremes, invalid words and addresses', () => {
		const f = fixture();
		for (const row of rows)
			if (row.kind === 'decode') {
				f.setDecoded(row.id);
				const statement = new ProgramStatement(row.binary, row.address, f.host);
				expect(
					f.state(statement, new ErrorList()),
					`decode ${row.id}/${row.binary}/${row.address}`
				).toEqual(row.state);
				expect(statement.getSourceFile()).toBe('');
				expect(statement.getSource()).toBe('');
				expect(statement.getSourceLine()).toBe(0);
				expect(statement.getOriginalTokenList()).toBeNull();
				expect(statement.getStrippedTokenList()).toBeNull();
				expect(statement.getSourceMIPSprogram()).toBeNull();
				expect(statement.getAddress()).toBe(row.address);
			}
	});
	it('preserves setters, malformed diagnostic rendering, nop fallback and pseudo expansion error', () => {
		const f = fixture();
		for (const row of rows)
			if (row.kind === 'special') {
				let statement: ProgramStatement;
				const errors = new ErrorList();
				if (row.name === 'pseudo-encoding') {
					const list = tokens([['OPERATOR', 'li', 7, 1]]);
					const instruction = new ExtendedInstruction('li $1,1', 'ori $1,$0,1', {
						tokenizeExampleInstruction: () => list,
						write: () => {},
						getDelayedBranchingEnabled: () => false
					});
					statement = new ProgramStatement(null, 'li', list, list, instruction, 0, 1, f.host);
					statement.buildMachineStatementFromBasicStatement(errors);
				} else if (row.name === 'nop-fallback') statement = new ProgramStatement(0, 0, f.host);
				else {
					statement = new ProgramStatement(-1, -4, f.host);
					statement.setSource('replacement source');
					statement.setBinaryStatement(0x80000000);
					statement.setBasicAssemblyStatement('custom -2147483648');
					statement.setMachineStatement('10000000000000000000000000000000');
					if (row.name !== 'setters') {
						statement.setBasicAssemblyStatement(null);
						statement.setMachineStatement(null);
					}
					if (row.name === 'malformed-basic') statement.setBasicAssemblyStatement('no-space');
				}
				expect(f.state(statement, errors), row.name).toEqual(row.state);
				expect(statement.getSource()).toBe(row.source);
				expect(statement.getSourceFile()).toBe(row.file);
				expect(statement.getInstruction()?.getName() ?? null).toBe(row.instruction);
			}
	});
	it('encodes every basic example and preserves branch/jump diagnostics, repeated builds and display bases', () => {
		const f = fixture();
		for (const row of rows)
			if (row.kind === 'encode') {
				const program: StatementProgram = {
					getFilename: () => 'probe',
					getSourceLineList: () => null,
					getLocalMacroPool: () => null,
					getLocalSymbolTable: () => ({
						getAddressLocalOrGlobal: (name) => (name === 'label' ? row.symbol : -1)
					})
				};
				const list = tokens(row.tokens);
				const statement = new ProgramStatement(
					program,
					row.label,
					list,
					list,
					f.instructions[row.id],
					row.address,
					7,
					f.host
				);
				const errors = new ErrorList();
				statement.buildBasicStatementFromBasicInstruction(errors);
				if (!errors.errorsOccurred()) statement.buildMachineStatementFromBasicStatement(errors);
				if (row.repeat) {
					statement.buildBasicStatementFromBasicInstruction(errors);
					statement.buildMachineStatementFromBasicStatement(errors);
				}
				expect(
					f.state(statement, errors),
					`encode ${row.id}/${row.label}/${row.address}/${row.symbol}/${row.repeat}`
				).toEqual(row.state);
				expect(statement.getSourceMIPSprogram()).toBe(program);
				expect(statement.getOriginalTokenList()).toBe(list);
				expect(statement.getStrippedTokenList()).toBe(list);
				expect(statement.getInstruction()).toBe(f.instructions[row.id]);
				expect(statement.getSource()).toBe(row.label);
				expect(statement.getSourceLine()).toBe(7);
			}
	});
});
