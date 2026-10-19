import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Instruction } from '#lib/engine/instructions/Instruction.js';
import { OperandFormat } from '#lib/engine/assembler/OperandFormat.js';
import { Token } from '#lib/engine/assembler/Token.js';
import { TokenList } from '#lib/engine/assembler/TokenList.js';
import { TokenTypes } from '#lib/engine/assembler/TokenTypes.js';
import { ErrorList } from '#lib/engine/diagnostics/ErrorList.js';
import { NumberFormatException } from '#lib/engine/formatting/Binary.js';
interface TokenRecord {
	type: string;
	value: string;
	line: number;
	column: number;
}
interface Spec {
	example: string;
	tokens: TokenRecord[];
}
interface Row {
	kind: 'check' | 'best';
	spec?: Spec;
	specs?: Spec[] | null;
	before: TokenRecord[];
	after: TokenRecord[];
	bare: boolean;
	result?: boolean | null;
	index?: number | null;
	failure: string | null;
	errors?: { file: string | null; line: number; column: number; message: string }[];
}
const captured = JSON.parse(
	readFileSync(new URL('./oracle/operand-format-units/golden.json', import.meta.url), 'utf8')
) as { stdout: string; stderr: string; status: number };
const rows = captured.stdout
	.trimEnd()
	.split('\n')
	.map((line) => JSON.parse(line) as Row);
const types = new Map(
	Object.values(TokenTypes)
		.filter((value): value is TokenTypes => value instanceof TokenTypes)
		.map((value) => [value.toString(), value])
);
function tokens(records: TokenRecord[]): TokenList {
	const list = new TokenList();
	for (const record of records)
		list.add(new Token(types.get(record.type)!, record.value, null, record.line, record.column));
	return list;
}
function record(list: TokenList): TokenRecord[] {
	return Array.from({ length: list.size() }, (_, i) => {
		const token = list.get(i);
		return {
			type: token.getType().toString(),
			value: token.getValue(),
			line: token.getSourceLine(),
			column: token.getStartPos()
		};
	});
}
/** Oracle descriptor snapshot supplies the already-tokenized specification consumed by OperandFormat. */
class Definition extends Instruction {
	constructor(spec: Spec) {
		super(spec.example, '', {
			tokenizeExampleInstruction: () => tokens(spec.tokens),
			write: () => {}
		});
		this.createExampleTokenList();
	}
}
describe('OperandFormat Java oracle', () => {
	it('captures successful Java execution', () => {
		expect(captured.status).toBe(0);
		expect(captured.stderr).toBe('');
		expect(rows.length).toBeGreaterThan(2000);
	});
	it('matches the complete type matrix, integer boundaries, real definitions and exact diagnostics', () => {
		for (const row of rows.filter((row) => row.kind === 'check')) {
			const list = tokens(row.before),
				errors = new ErrorList();
			const match = () =>
				OperandFormat.tokenOperandMatch(list, new Definition(row.spec!), errors, {
					getBareMachineEnabled: () => row.bare
				});
			if (row.failure !== null)
				expect(match, JSON.stringify(row)).toThrow(
					row.failure === 'NumberFormatException' ? NumberFormatException : RangeError
				);
			else expect(match(), JSON.stringify(row)).toBe(row.result);
			expect(record(list)).toEqual(row.after);
			expect(
				errors.getErrorMessages().map((error) => ({
					file: error.getFilename(),
					line: error.getLine(),
					column: error.getPosition(),
					message: error.getMessage()
				}))
			).toEqual(row.errors);
		}
	});
	it('preserves overload order, fallback, register mode and candidate mutation', () => {
		for (const row of rows.filter((row) => row.kind === 'best')) {
			const list = tokens(row.before),
				definitions = row.specs === null ? null : row.specs!.map((spec) => new Definition(spec));
			const match = () =>
				OperandFormat.bestOperandMatch(list, definitions, {
					getBareMachineEnabled: () => row.bare
				});
			if (row.failure !== null) expect(match).toThrow(RangeError);
			else {
				const result = match();
				expect(result === null ? null : definitions!.indexOf(result), JSON.stringify(row)).toBe(
					row.index
				);
			}
			expect(record(list)).toEqual(row.after);
		}
	});
});
