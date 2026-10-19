import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Directives } from '#lib/engine/assembler/Directives.js';
import { Symbol } from '#lib/engine/assembler/Symbol.js';
import { DelayedBranch } from '#lib/engine/simulator/DelayedBranch.js';

const fixture: { stdout: string; stderr: string; exitCode: number } = JSON.parse(
	readFileSync(new URL('./oracle/assembler-units/golden.json', import.meta.url), 'utf8')
);
const lines = fixture.stdout
	.trimEnd()
	.split('\n')
	.map((line) => line.split('\t'));

describe('assembler foundation Java oracle', () => {
	it('matches all directive names, help text, order, and numeric kinds', () => {
		const actual = Directives.getDirectiveList().map((directive) => [
			'directive',
			directive.getName(),
			directive.toString(),
			directive.getDescription(),
			String(Directives.isIntegerDirective(directive)),
			String(Directives.isFloatingDirective(directive))
		]);
		expect(actual).toEqual(lines.filter((line) => line[0] === 'directive'));
	});

	it('matches directive lookup and completion including case boundaries', () => {
		for (const [kind, candidate, expected] of lines) {
			if (kind === 'match')
				expect(Directives.matchDirective(candidate)?.getName() ?? 'null').toBe(expected);
			if (kind === 'prefix')
				expect(
					Directives.prefixMatchDirectives(candidate)
						?.map((item) => item.getName())
						.join(',') ?? 'null'
				).toBe(expected);
		}
		expect([
			'null-kind',
			String(Directives.isIntegerDirective(null)),
			String(Directives.isFloatingDirective(null))
		]).toEqual(lines.find((line) => line[0] === 'null-kind'));
		expect(Directives.matchDirective('.WORD')).toBe(Directives.WORD);
	});

	it('matches label metadata and address updates at signed integer boundaries', () => {
		const observed: string[][] = [];
		for (const address of [0, -1, -2147483648, 2147483647, 0x10010000]) {
			for (const data of [Symbol.DATA_SYMBOL, Symbol.TEXT_SYMBOL]) {
				const symbol = new Symbol('Label.$', address, data);
				observed.push([
					'symbol',
					symbol.getName(),
					String(symbol.getAddress()),
					String(symbol.getType())
				]);
				symbol.setAddress(~address);
				observed.push(['readdress', String(symbol.getAddress())]);
			}
		}
		expect(observed).toEqual(lines.filter((line) => ['symbol', 'readdress'].includes(line[0])));
		expect(fixture.stderr).toBe('');
		expect(fixture.exitCode).toBe(0);
	});

	it('matches delayed-branch transitions including a branch in the delay slot', () => {
		const branch = new DelayedBranch();
		const observed: string[][] = [];
		const record = (label: string) =>
			observed.push([
				'branch',
				label,
				String(branch.isRegistered()),
				String(branch.isTriggered()),
				String(branch.getBranchTargetAddress())
			]);
		record('initial');
		branch.trigger();
		record('trigger-cleared');
		branch.register(0x80000000);
		record('register');
		branch.register(0x400004);
		record('register-twice');
		branch.trigger();
		record('trigger');
		branch.trigger();
		record('trigger-twice');
		branch.register(-1);
		record('branch-in-delay-slot');
		branch.trigger();
		record('trigger-extended');
		branch.clear();
		record('clear');
		branch.clear();
		record('clear-twice');
		branch.register(-1);
		record('new-branch');
		branch.clear();
		record('clear-untriggered');
		expect(observed).toEqual(lines.filter((line) => line[0] === 'branch'));
	});

	it('keeps symbol and pending-branch state independent between sessions', () => {
		const first = new DelayedBranch();
		const second = new DelayedBranch();
		first.register(0x80000000);
		first.trigger();
		expect(second.isTriggered()).toBe(false);
		expect(second.getBranchTargetAddress()).toBe(0);
		const firstLabel = new Symbol('main', 0, false);
		const secondLabel = new Symbol('main', 0, false);
		firstLabel.setAddress(0xffffffff);
		expect(firstLabel.getAddress()).toBe(-1);
		expect(secondLabel.getAddress()).toBe(0);
	});
});
