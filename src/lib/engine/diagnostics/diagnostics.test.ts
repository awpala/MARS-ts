import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ErrorMessage, type DiagnosticProgram } from './ErrorMessage.js';
import { ErrorList } from './ErrorList.js';
import { ProcessingException } from './ProcessingException.js';
import { RegisterFile } from '../hardware/registers/RegisterFile.js';
import { Coprocessor0 } from '../hardware/registers/Coprocessor0.js';
import { AddressErrorException } from '../hardware/memory/AddressErrorException.js';
import { Exceptions } from '../simulator/Exceptions.js';

const fixture = JSON.parse(readFileSync('tests/oracle/diagnostics-units/golden.json', 'utf8')) as {
	stdout: string;
	stderr: string;
	status: number;
};

describe('MARS diagnostics oracle', () => {
	it('matches Java locations, macro histories, report order, paths, counters, and error limits', () => {
		const rows: string[] = [];
		const output = (key: string, value: string) =>
			rows.push(`${key}\t${Buffer.from(value).toString('base64')}`);
		const message = (key: string, value: ErrorMessage) =>
			output(
				key,
				`${value.isWarning()}|${value.getFilename()}|${value.getLine()}|${value.getPosition()}|${value.getMessage()}|${value.getMacroExpansionHistory()}`
			);
		const basic = new ErrorMessage('file.asm', 4, 8, 'bad operand');
		const warning = new ErrorMessage(true, 'inc.asm', 6, 2, 'warning', '12->20');
		message('basic', basic);
		message('warning', warning);
		message('null-program', new ErrorMessage(null, -1, 0, 'unknown'));
		message('null-history', new ErrorMessage('name.asm', 0, -1, 'empty', null));
		const program: DiagnosticProgram = {
			getFilename: () => null,
			getSourceLineList: () => null,
			getLocalMacroPool: () => null
		};
		message('default-program', new ErrorMessage(program, 2, 1, 'default'));
		message(
			'include',
			new ErrorMessage(
				{
					...program,
					getFilename: () => 'top.asm',
					getSourceLineList: () => [{ getFilename: () => 'included.asm', getLineNumber: () => 91 }]
				},
				1,
				3,
				'mapped'
			)
		);
		const sources = [
			'syscall',
			'  <13> syscall',
			'<13> <25> syscall',
			'label: <3> syscall',
			'<2147483648> syscall',
			'<0012> syscall',
			'<13> x <22>',
			'\u00a0<13> syscall'
		];
		sources.forEach((source, i) =>
			message(
				`runtime-${i}`,
				new ErrorMessage(
					{ getSourceMIPSprogram: () => null, getSourceLine: () => 40, getSource: () => source },
					'runtime'
				)
			)
		);
		const list = new ErrorList();
		list.add(basic);
		list.add(warning, 0);
		list.add(new ErrorMessage('a//b///', 0, 0, 'path'));
		list.add(new ErrorMessage('/', -1, 3, 'root'));
		list.add(new ErrorMessage(null, 0, 0, 'no location'));
		output('report', list.generateErrorAndWarningReport());
		output(
			'counts',
			`${list.errorCount()}|${list.warningCount()}|${list.errorsOccurred()}|${list.warningsOccurred()}|${list.errorLimitExceeded()}|${list.getErrorLimit()}`
		);
		const limit = new ErrorList();
		for (let i = 0; i < limit.getErrorLimit(); i++) limit.add(new ErrorMessage('x', i + 1, 2, 'e'));
		limit.add(new ErrorMessage(true, 'x', 999, 3, 'ignored warning', ''), 0);
		limit.add(basic);
		output(
			'limit',
			`${limit.errorCount()}|${limit.warningCount()}|${limit.errorLimitExceeded()}|${limit.getErrorMessages().length}`
		);
		message('terminal', limit.getErrorMessages().at(-1)!);
		const empty = new ErrorList();
		output(
			'empty',
			`${empty.generateErrorAndWarningReport()}|${empty.errorsOccurred()}|${empty.warningsOccurred()}`
		);

		output('processing-exit', String(new ProcessingException().errors() === null));
		output('processing-list', String(new ProcessingException(list).errors() === list));
		const registers = new RegisterFile();
		const cp0 = new Coprocessor0();
		const exceptions = new Exceptions(cp0, registers);
		const host = {
			getProgramCounter: () => registers.getProgramCounter(),
			setRegisters: (cause: number, address?: number) => exceptions.setRegisters(cause, address)
		};
		for (let kind = 0; kind < 4; kind++) {
			registers.initializeProgramCounter(0);
			cp0.resetRegisters();
			const statement = {
				getSourceMIPSprogram: () => null,
				getSource: () => '<13> syscall',
				getSourceLine: () => 40
			};
			const address = new AddressErrorException('bad address ', 4, 0x80000001);
			const exception =
				kind === 0
					? new ProcessingException(statement, 'problem', host)
					: kind === 1
						? new ProcessingException(statement, 'problem', host, 12)
						: kind === 2
							? new ProcessingException(statement, address, host)
							: new ProcessingException(list, address, host);
			output('processing-report-' + kind, exception.errors()!.generateErrorAndWarningReport());
			output(
				'processing-registers-' + kind,
				[8, 12, 13, 14].map((number) => cp0.getValue(number)).join('|')
			);
		}

		expect(fixture.stderr).toBe('');
		expect(fixture.status).toBe(0);
		expect(`${rows.join('\n')}\n`).toBe(fixture.stdout);
	});
	it('keeps limits and state instance-owned and rejects invalid source indices', () => {
		const one = new ErrorList(1);
		one.add(new ErrorMessage(null, 1, 1, 'first'));
		one.add(new ErrorMessage(null, 2, 1, 'second'));
		expect(one.errorLimitExceeded()).toBe(true);
		expect(new ErrorList().errorsOccurred()).toBe(false);
		expect(
			() =>
				new ErrorMessage(
					{ getFilename: () => 'x', getSourceLineList: () => [], getLocalMacroPool: () => null },
					1,
					0,
					'x'
				)
		).toThrow(RangeError);
	});
});
