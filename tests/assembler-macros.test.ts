import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TokenTypes, type TokenClassificationContext } from '#lib/engine/assembler/TokenTypes.js';
import { Macro, type MacroProgram, type MacroRegisters } from '#lib/engine/assembler/Macro.js';
import { MacroPool } from '#lib/engine/assembler/MacroPool.js';
import { Token } from '#lib/engine/assembler/Token.js';
import { TokenList } from '#lib/engine/assembler/TokenList.js';
import { RegisterFile } from '#lib/engine/hardware/RegisterFile.js';
import { Coprocessor0 } from '#lib/engine/hardware/Coprocessor0.js';
import { Coprocessor1 } from '#lib/engine/hardware/Coprocessor1.js';
import { ErrorList } from '#lib/engine/diagnostics/ErrorList.js';

const fixture: { stdout: string } = JSON.parse(
	readFileSync(new URL('./oracle/assembler-units/golden.json', import.meta.url), 'utf8')
);
const lines = fixture.stdout
	.trimEnd()
	.split('\n')
	.map((line) => line.split('\t'));
const registers: MacroRegisters = {
	registerFile: new RegisterFile(),
	coprocessor0: new Coprocessor0(),
	coprocessor1: new Coprocessor1()
};
const encode = (value: string | null) => Buffer.from(value ?? '').toString('base64');
const token = (value: string) => new Token(TokenTypes.IDENTIFIER, value, null, 3, 7);
function tokens(...values: string[]): TokenList {
	const result = new TokenList();
	values.forEach((value) => result.add(token(value)));
	return result;
}
function location(value: string, line: number, original: number): Token {
	const result = new Token(TokenTypes.IDENTIFIER, value, null, line, 1);
	result.setOriginal(null, original);
	return result;
}

describe('token classification and macro Java oracle', () => {
	it('matches lexical precedence, Java numeric grammar, Unicode identifiers, and SPIM parameters', () => {
		const lexical = lines.filter((line) => line[0] === 'lexical');
		const operatorLookups = new Map(
			lexical.map((line) => [Buffer.from(line[1], 'base64').toString(), line[4] === 'true'])
		);
		const context: TokenClassificationContext = {
			...registers,
			instructionSet: { matchOperator: (value) => (operatorLookups.get(value) ? [] : null) }
		};
		for (const [, encoded, expectedType, expectedIdentifier, , percent, spim] of lexical) {
			const value = Buffer.from(encoded, 'base64').toString();
			if (expectedType.startsWith('error:'))
				expect(() => TokenTypes.matchTokenType(value, context)).toThrow(RangeError);
			else
				expect(TokenTypes.matchTokenType(value, context).toString(), JSON.stringify(value)).toBe(
					expectedType
				);
			if (expectedIdentifier.startsWith('error:'))
				expect(() => TokenTypes.isValidIdentifier(value)).toThrow(RangeError);
			else
				expect(String(TokenTypes.isValidIdentifier(value)), JSON.stringify(value)).toBe(
					expectedIdentifier
				);
			expect(String(Macro.tokenIsMacroParameter(value, false, registers)), value).toBe(percent);
			expect(String(Macro.tokenIsMacroParameter(value, true, registers)), value).toBe(spim);
		}
		expect(TokenTypes.isIntegerTokenType(TokenTypes.INTEGER_5)).toBe(true);
		expect(TokenTypes.isIntegerTokenType(TokenTypes.INTEGER_16)).toBe(true);
		expect(TokenTypes.isIntegerTokenType(TokenTypes.INTEGER_16U)).toBe(true);
		expect(TokenTypes.isIntegerTokenType(TokenTypes.INTEGER_32)).toBe(true);
		expect(TokenTypes.isIntegerTokenType(TokenTypes.REAL_NUMBER)).toBe(false);
		expect(TokenTypes.isFloatingTokenType(TokenTypes.REAL_NUMBER)).toBe(true);
		expect(TokenTypes.isFloatingTokenType(null)).toBe(false);
	});

	it('matches macro definition mutation, equality, substitution quirks, and errors', () => {
		const sourceLines = [
			'loop: add %arg, %arg # %arg',
			'loop loop',
			'add $param, $t0, $f0',
			'missing %unknown',
			'already replaced'
		];
		const tokenLines = [
			tokens('loop', ':', 'add', '%arg', '%arg', '# %arg'),
			tokens('loop', 'loop'),
			tokens('add', '$param', '$t0', '$f0'),
			tokens('missing', '%unknown'),
			tokens('%arg')
		];
		const program: MacroProgram = {
			getFilename: () => 'macros.asm',
			getSourceLineList: () => null,
			getLocalMacroPool: () => null,
			getTokenList: () => tokenLines,
			getSourceLine: (line) => sourceLines[line - 1] ?? null
		};
		const macro = new Macro(registers);
		expect([
			'macro-default',
			macro.getName(),
			String(macro.getProgram()),
			String(macro.getFromLine()),
			String(macro.getToLine()),
			String(macro.getOriginalFromLine()),
			String(macro.getOriginalToLine()),
			String(macro.getArgs().length)
		]).toEqual(lines.find((line) => line[0] === 'macro-default'));
		macro.setName('example');
		macro.setProgram(program);
		macro.setFromLine(2);
		macro.setToLine(9);
		macro.setOriginalFromLine(1);
		macro.setOriginalToLine(8);
		const formal = ['%arg'];
		macro.setArgs(formal);
		formal.push('$param');
		expect([
			'macro-properties',
			macro.getName(),
			String(macro.getProgram() === program),
			String(macro.getFromLine()),
			String(macro.getToLine()),
			String(macro.getOriginalFromLine()),
			String(macro.getOriginalToLine()),
			String(macro.getArgs().length)
		]).toEqual(lines.find((line) => line[0] === 'macro-properties'));
		const equal = new Macro(registers);
		equal.setName('example');
		equal.addArg('%different');
		equal.addArg('%other');
		expect([
			'macro-equal',
			String(macro.equals(equal)),
			String(macro.equals(macro)),
			String(macro.equals(null)),
			String(macro.equals('example'))
		]).toEqual(lines.find((line) => line[0] === 'macro-equal'));
		equal.addArg('%third');
		expect(['macro-arity', String(macro.equals(equal))]).toEqual(
			lines.find((line) => line[0] === 'macro-arity')
		);
		macro.addLabel('zebra');
		macro.addLabel('loop');
		macro.readyForCommit();
		const errors = new ErrorList();
		const args = tokens('example', '$s0', '42');
		const expansions = sourceLines.map((_, index) => [
			'macro-expand',
			String(index + 1),
			encode(macro.getSubstitutedLine(index + 1, args, 7n, errors))
		]);
		expect(expansions).toEqual(lines.filter((line) => line[0] === 'macro-expand'));
		expect([
			'macro-long',
			encode(macro.getSubstitutedLine(2, args, -9223372036854775808n, errors))
		]).toEqual(lines.find((line) => line[0] === 'macro-long'));
		const error = errors.getErrorMessages()[0];
		expect([
			'macro-error',
			String(errors.errorCount()),
			error.getFilename(),
			String(error.getLine()),
			String(error.getPosition()),
			error.getMessage()
		]).toEqual(lines.find((line) => line[0] === 'macro-error'));
	});

	it('matches macro selection, ignored caller position, counters, recursion stacks, and underflow', () => {
		const pool = new MacroPool(null, registers);
		expect([
			'pool-default',
			String(pool.getCurrent()),
			String(pool.getNextCounter()),
			String(pool.getNextCounter()),
			String(pool.matchesAnyMacroName('call'))
		]).toEqual(lines.find((line) => line[0] === 'pool-default'));
		let earlierAtSameLine: Macro | null = null;
		for (const line of [10, 30, 30]) {
			pool.beginMacro(location('call', line, line / 10));
			const current = pool.getCurrent()!;
			current.addArg('%arg');
			if (line === 30 && earlierAtSameLine === null) earlierAtSameLine = current;
			pool.commitMacro(location('.end_macro', line + 5, line / 10 + 1));
		}
		pool.beginMacro(location('call', 50, 5));
		pool.commitMacro(location('.end_macro', 55, 6));
		const match = pool.getMatchingMacro(tokens('call', '1'), 1)!;
		expect(match).toBe(earlierAtSameLine);
		expect([
			'pool-match',
			String(match.getFromLine()),
			String(match.getToLine()),
			String(match.getOriginalFromLine()),
			String(match.getOriginalToLine()),
			String(pool.getMatchingMacro(tokens('call'), 1)?.getFromLine()),
			String(pool.getMatchingMacro(tokens(), 1)),
			String(pool.getMatchingMacro(tokens('CALL', '1'), 1)),
			String(pool.matchesAnyMacroName('call'))
		]).toEqual(lines.find((line) => line[0] === 'pool-match'));
		const macro = new Macro(registers);
		pool.setCurrent(macro);
		expect(['pool-set', String(pool.getCurrent() === macro)]).toEqual(
			lines.find((line) => line[0] === 'pool-set')
		);
		pool.setCurrent(null);
		expect([
			'pool-stack',
			String(pool.pushOnCallStack(location('call', 2, 200))),
			String(pool.pushOnCallStack(location('call', 3, 300))),
			String(pool.pushOnCallStack(location('call', 2, 400))),
			`[${pool.getCallStack().join(', ')}]`,
			pool.getExpansionHistory()
		]).toEqual(lines.find((line) => line[0] === 'pool-stack'));
		pool.popFromCallStack();
		expect(['pool-pop', String(pool.getCallStack().length), pool.getExpansionHistory()]).toEqual(
			lines.find((line) => line[0] === 'pool-pop')
		);
		pool.popFromCallStack();
		expect(['pool-empty', String(pool.getCallStack().length), pool.getExpansionHistory()]).toEqual(
			lines.find((line) => line[0] === 'pool-empty')
		);
		expect(() => pool.popFromCallStack()).toThrow(
			lines.find((line) => line[0] === 'pool-underflow')![1]
		);
		expect(new MacroPool(null, registers).getNextCounter()).toBe(0);
	});
});
