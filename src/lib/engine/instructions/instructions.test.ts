import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BasicInstruction } from './BasicInstruction.js';
import { BasicInstructionFormat } from './BasicInstructionFormat.js';
import { TokenList } from '../assembler/TokenList.js';
import { Tokenizer } from '../assembler/Tokenizer.js';
import { RegisterFile } from '../hardware/RegisterFile.js';
import { Coprocessor1 } from '../hardware/Coprocessor1.js';
import { Coprocessor0 } from '../hardware/Coprocessor0.js';
import type { TokenClassificationContext } from '../assembler/TokenTypes.js';
import { ErrorList } from '../diagnostics/ErrorList.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';

const fixture = JSON.parse(readFileSync('tests/oracle/instruction-units/golden.json', 'utf8')) as {
	stdout: string;
	stderr: string;
	status: number;
};
const decode = (text: string) => Buffer.from(text, 'base64').toString('utf8');
const formats: Record<string, BasicInstructionFormat> = {
	R: BasicInstructionFormat.R_FORMAT,
	I: BasicInstructionFormat.I_FORMAT,
	B: BasicInstructionFormat.I_BRANCH_FORMAT,
	J: BasicInstructionFormat.J_FORMAT
};

describe('canonical basic instruction descriptors', () => {
	it('matches masks, format, lengths, descriptions, and names for every Java basic instruction', () => {
		const output: string[] = [];
		const rows = fixture.stdout
			.trimEnd()
			.split('\n')
			.map((row) => row.split('\t'));
		const operators = new Set(rows.slice(0, -1).map((row) => decode(row[7])));
		const context: TokenClassificationContext = {
			registerFile: new RegisterFile(),
			coprocessor0: new Coprocessor0(),
			coprocessor1: new Coprocessor1(),
			instructionSet: { matchOperator: (name) => (operators.has(name) ? [] : null) }
		};
		const host = {
			tokenizeExampleInstruction: (example: string) =>
				new Tokenizer(context).tokenizeExampleInstruction(example),
			write: (text: string) => output.push(text)
		};
		let count = 0;
		for (const row of rows) {
			const [
				example,
				description,
				mask,
				format,
				opcodeMask,
				opcodeMatch,
				length,
				name,
				tokens,
				types
			] = row;
			const simulation = { simulate: () => undefined };
			const spaced = mask.match(/.{1,8}/g)!.join(' ');
			const instruction = new BasicInstruction(
				decode(example),
				decode(description),
				formats[format],
				spaced,
				simulation,
				host
			);
			expect([
				instruction.getOpcodeMask(),
				instruction.getOpcodeMatch(),
				instruction.getInstructionLength()
			]).toEqual([Number(opcodeMask), Number(opcodeMatch), Number(length)]);
			expect(instruction.getName()).toBe(decode(name));
			expect(instruction.getDescription()).toBe(decode(description));
			expect(instruction.getExampleFormat()).toBe(decode(example));
			expect(instruction.getOperationMask()).toBe(mask);
			expect(instruction.getInstructionFormat()).toBe(formats[format]);
			expect(instruction.getSimulationCode()).toBe(simulation);
			expect(instruction.getTokenList()).toBeNull();
			instruction.createExampleTokenList();
			expect(instruction.getTokenList()?.toString()).toBe(decode(tokens));
			expect(instruction.getTokenList()?.toTypeString()).toBe(decode(types));
			count++;
		}
		expect(count).toBeGreaterThan(100);
		expect(output).toEqual([]);
		expect(fixture.stderr).toBe('');
		expect(fixture.status).toBe(0);
	});
	it('retains tokenizer and callback identity, and routes configuration errors through the host', () => {
		const tokens = new TokenList();
		let observed = 0;
		const messages: string[] = [];
		const host = {
			tokenizeExampleInstruction: () => tokens,
			write: (text: string) => messages.push(text)
		};
		const instruction = new BasicInstruction(
			'custom $1',
			BasicInstructionFormat.R_FORMAT,
			'0'.repeat(32),
			{
				simulate: (value: number) => {
					observed = value;
				}
			},
			host
		);
		instruction.createExampleTokenList();
		expect(instruction.getTokenList()).toBe(tokens);
		expect(instruction.getDescription()).toBe('');
		instruction.getSimulationCode().simulate(7);
		expect(observed).toBe(7);
		host.tokenizeExampleInstruction = () => {
			throw new ProcessingException(new ErrorList());
		};
		instruction.createExampleTokenList();
		expect(instruction.getTokenList()).toBe(tokens);
		expect(messages).toEqual([
			'CONFIGURATION ERROR: Instruction example "custom $1" contains invalid token(s).\n'
		]);
	});
});
