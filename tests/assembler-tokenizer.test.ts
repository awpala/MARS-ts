import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	Tokenizer,
	type TokenizerProgram,
	type TokenizerSourceHost
} from '#lib/engine/assembler/Tokenizer.js';
import { TokenList } from '#lib/engine/assembler/TokenList.js';
import { SourceLine } from '#lib/engine/assembler/SourceLine.js';
import type { TokenClassificationContext } from '#lib/engine/assembler/TokenTypes.js';
import { JavaCharacter } from '#lib/engine/assembler/JavaCharacter.js';
import { RegisterFile } from '#lib/engine/hardware/RegisterFile.js';
import { Coprocessor0 } from '#lib/engine/hardware/Coprocessor0.js';
import { Coprocessor1 } from '#lib/engine/hardware/Coprocessor1.js';
import { ErrorList } from '#lib/engine/diagnostics/ErrorList.js';
import { ProcessingException } from '#lib/engine/diagnostics/ProcessingException.js';

interface TokenRecord {
	type: string;
	value: string;
	line: number;
	column: number;
	originalLine: number;
	program: string | null;
	originalProgram: string | null;
}
interface ListRecord {
	processed: string;
	tokens: TokenRecord[];
}
interface ErrorRecord {
	file: string | null;
	line: number;
	column: number;
	message: string;
	history: string;
	warning: boolean;
}
interface Fixture {
	kind: string;
	names?: string[];
	line?: string;
	eqv?: boolean;
	id?: string;
	result?: ListRecord | ListRecord[] | null;
	failure?: string | null;
	errors?: ErrorRecord[];
	internalErrors?: ErrorRecord[];
	callerErrors?: ErrorRecord[];
	example?: ListRecord | null;
	sourceMap?: { source: string; file: string | null; line: number }[] | null;
	plainSource?: string[];
}
const captured: { stdout: string; stderr: string; status: number } = JSON.parse(
	readFileSync(new URL('./oracle/tokenizer-units/golden.json', import.meta.url), 'utf8')
);
const fixtures: Fixture[] = captured.stdout
	.trimEnd()
	.split('\n')
	.map((line) => JSON.parse(line));
const operators = new Set(fixtures.find((fixture) => fixture.kind === 'operators')!.names!);
function context(): TokenClassificationContext {
	return {
		registerFile: new RegisterFile(),
		coprocessor0: new Coprocessor0(),
		coprocessor1: new Coprocessor1(),
		instructionSet: { matchOperator: (name) => (operators.has(name.toLowerCase()) ? [] : null) }
	};
}
function tokenList(list: TokenList | null): ListRecord | null {
	if (list === null) return null;
	return {
		processed: list.getProcessedLine(),
		tokens: Array.from({ length: list.size() }, (_, index) => {
			const token = list.get(index);
			return {
				type: token.getType().toString(),
				value: token.getValue(),
				line: token.getSourceLine(),
				column: token.getStartPos(),
				originalLine: token.getOriginalSourceLine(),
				program: token.getSourceMIPSprogram()?.getFilename() ?? null,
				originalProgram: token.getOriginalProgram()?.getFilename() ?? null
			};
		})
	};
}
function errors(list: ErrorList): ErrorRecord[] {
	return list.getErrorMessages().map((error) => ({
		file: error.getFilename(),
		line: error.getLine(),
		column: error.getPosition(),
		message: error.getMessage(),
		history: error.getMacroExpansionHistory(),
		warning: error.isWarning()
	}));
}
function failure(error: unknown): string {
	if (error instanceof ProcessingException) return 'ProcessingException';
	if (error instanceof TypeError) return 'NullPointerException';
	if (error instanceof RangeError) return 'StringIndexOutOfBoundsException';
	throw error;
}
class Program implements TokenizerProgram {
	mapping: SourceLine<TokenizerProgram>[] | null = null;
	constructor(
		readonly filename: string,
		private lines: string[]
	) {}
	getFilename(): string {
		return this.filename;
	}
	getSourceList(): string[] {
		return this.lines;
	}
	getSourceLineList(): SourceLine<TokenizerProgram>[] | null {
		return this.mapping;
	}
	getLocalMacroPool(): null {
		return null;
	}
	setSourceLineList(lines: SourceLine<TokenizerProgram>[]): void {
		this.mapping = lines;
		this.lines = lines.map((line) => line.getSource());
	}
}
function fileProgram(filename: string): Program {
	const source = readFileSync(filename, 'utf8');
	const lines = source.split(/\r\n|\n|\r/);
	if (lines[lines.length - 1] === '') lines.pop();
	return new Program(filename, lines);
}
const sourceHost: TokenizerSourceHost = {
	separator: '/',
	isAbsolute: (name) => name.startsWith('/'),
	getParent: (name) => {
		const index = name.lastIndexOf('/');
		return index < 0 ? null : index === 0 ? '/' : name.slice(0, index);
	},
	readSource: (name) => {
		try {
			return fileProgram(name);
		} catch {
			throw new ProcessingException(new ErrorList());
		}
	}
};
function wholeProgram(id: string): Program {
	switch (id) {
		case 'eqv':
			return new Program('eqv.asm', [
				'.eqv ONE, 1',
				'.eqv TWO, ONE + ONE # hi',
				'label: li $t0,TWO',
				'.eqv ONE, 1',
				'.ascii "ONE" # ONE',
				'ONE: .word ONE',
				''
			]);
		case 'eqv-errors':
			return new Program('eqv-errors.asm', [
				'.eqv ONE 1',
				'.eqv ONE 2',
				'.eqv 3 4',
				'.eqv SELF (SELF)',
				'.eqv MISSING #hi',
				'@'
			]);
		case 'eqv-character':
			return new Program('eqv-character.asm', [
				".eqv CHAR 'a'",
				'li $t0,CHAR',
				".eqv NEWLINE '\\n'",
				'li $t0,NEWLINE'
			]);
		case 'empty':
			return new Program('empty.asm', []);
		case 'no-parent':
			return new Program('main.asm', ['.include "absent.inc"']);
		case 'include-unclosed':
			return new Program('tests/oracle/tokenizer-units/inputs/virtual.asm', ['.include "abc']);
		case 'include-quote-only':
			return new Program('tests/oracle/tokenizer-units/inputs/virtual.asm', ['.include "']);
		default:
			return fileProgram(`tests/oracle/tokenizer-units/inputs/${id}.asm`);
	}
}

describe('Tokenizer Java oracle', () => {
	it('matches original token splitting, escapes, numeric signs, strings, comments, positions, and diagnostic routing', () => {
		for (const fixture of fixtures.filter((record) => record.kind === 'line')) {
			const tokenizer = new Tokenizer(context());
			const caller = new ErrorList();
			let result: TokenList | null = null;
			let thrown: string | null = null;
			try {
				result = tokenizer.tokenizeLine(7, fixture.line!, caller, fixture.eqv);
			} catch (error) {
				thrown = failure(error);
			}
			expect(
				{
					kind: 'line',
					line: fixture.line,
					eqv: fixture.eqv,
					result: tokenList(result),
					failure: thrown,
					errors: errors(caller),
					internalErrors: errors(tokenizer.getErrors())
				},
				JSON.stringify(fixture.line)
			).toEqual(fixture);
		}
	});
	it('matches whole-program includes, eqv re-tokenization, source mapping, and all lexical failures', () => {
		for (const fixture of fixtures.filter((record) => record.kind === 'program')) {
			const program = wholeProgram(fixture.id!);
			const tokenizer = new Tokenizer(context(), null, sourceHost);
			let result: TokenList[] | null = null;
			let thrown: string | null = null;
			try {
				result = tokenizer.tokenize(program);
			} catch (error) {
				thrown = failure(error);
			}
			expect(
				{
					kind: 'program',
					id: fixture.id,
					failure: thrown,
					result: result?.map(tokenList) ?? null,
					sourceMap:
						program.mapping?.map((line) => ({
							source: line.getSource(),
							file: line.getFilename(),
							line: line.getLineNumber()
						})) ?? null,
					plainSource: program.getSourceList(),
					errors: errors(tokenizer.getErrors())
				},
				fixture.id
			).toEqual(fixture);
		}
	});
	it('restores caller diagnostic routing while retaining errors accumulated on the tokenizer', () => {
		const tokenizer = new Tokenizer(context());
		const caller = new ErrorList();
		tokenizer.tokenizeLine(1, '@', caller);
		let result: TokenList | null = null;
		let thrown: string | null = null;
		try {
			result = tokenizer.tokenizeExampleInstruction('add $1,$2,$3');
		} catch (error) {
			thrown = failure(error);
		}
		expect({
			kind: 'caller-restoration',
			example: tokenList(result),
			failure: thrown,
			callerErrors: errors(caller),
			internalErrors: errors(tokenizer.getErrors())
		}).toEqual(fixtures.find((record) => record.kind === 'caller-restoration'));
		tokenizer.tokenizeLine(1, '@');
		thrown = null;
		try {
			tokenizer.tokenizeExampleInstruction('add $1,$2,$3');
		} catch (error) {
			thrown = failure(error);
		}
		expect({
			kind: 'pending-errors',
			failure: thrown,
			errors: errors(tokenizer.getErrors())
		}).toEqual(fixtures.find((record) => record.kind === 'pending-errors'));
	});
	it('keeps equivalence dictionaries and errors independent between tokenizer instances', () => {
		const first = new Tokenizer(context());
		const second = new Tokenizer(context());
		first.tokenize(new Program('first.asm', ['.eqv VALUE 42']));
		second.tokenize(new Program('second.asm', []));
		expect(first.tokenizeLine(1, 'VALUE').get(0).getValue()).toBe('42');
		expect(second.tokenizeLine(1, 'VALUE').get(0).getValue()).toBe('VALUE');
		first.tokenizeLine(1, '@');
		expect(first.getErrors().errorCount()).toBe(1);
		expect(second.getErrors().errorCount()).toBe(0);
	});
	it('uses the pinned Java character table for every UTF-16 code unit', () => {
		const expected: { letterRanges: number[][]; digitRanges: number[][] } = JSON.parse(
			readFileSync(new URL('./oracle/highlighting/character-data.json', import.meta.url), 'utf8')
		);
		const letters = new Uint8Array(65536);
		const digits = new Uint8Array(65536);
		for (const [start, end] of expected.letterRanges) letters.fill(1, start, end + 1);
		for (const [start, end] of expected.digitRanges) digits.fill(1, start, end + 1);
		const mismatches: string[] = [];
		for (let code = 0; code < 65536; code++) {
			const character = String.fromCharCode(code);
			if (JavaCharacter.isLetter(character) !== (letters[code] === 1))
				mismatches.push(`letter U+${code.toString(16)}`);
			if (JavaCharacter.isDigit(character) !== (digits[code] === 1))
				mismatches.push(`digit U+${code.toString(16)}`);
			if (JavaCharacter.isLetterOrDigit(character) !== (letters[code] === 1 || digits[code] === 1))
				mismatches.push(`letter/digit U+${code.toString(16)}`);
		}
		expect(mismatches).toEqual([]);
		expect(captured.stderr).toBe('');
		expect(captured.status).toBe(0);
	});
});
