import { readOracleJson } from '../oracle/fixtures.js';
import { describe, expect, it } from 'vitest';
import { Globals, type GlobalsHost } from '#lib/engine/Globals.js';
import { Settings } from '#lib/engine/Settings.js';
import { RunController } from '#lib/venus/RunController.js';
import { Simulator } from '#lib/engine/simulator/Simulator.js';
import { ProcessingException } from '#lib/engine/diagnostics/ProcessingException.js';

function session(source: string, overrides: Partial<GlobalsHost> = {}) {
	const files = new Map([['main.asm', source]]),
		output: string[] = [];
	const globals = new Globals({
		readSource: (name) => {
			const text = files.get(name);
			if (text === undefined) throw new Error(`Missing virtual source: ${name}`);
			return text;
		},
		sourcePaths: {
			separator: '/',
			isAbsolute: (name) => name.startsWith('/'),
			getParent: (name) => (name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : null)
		},
		readInput: () => '',
		printString: (text) => output.push(text),
		yieldControl: async () => {},
		...overrides
	});
	return { globals, controller: new RunController(globals), files, output };
}

describe('Settings Java oracle', () => {
	it('uses the canonical default for malformed boolean preferences without trimming', () => {
		for (const value of ['invalid', '', ' true ', ' false ']) {
			const settings = new Settings({ readPreference: () => value });
			expect(settings.getExtendedAssemblerEnabled()).toBe(true);
			expect(settings.getDelayedBranchingEnabled()).toBe(false);
		}
		expect(new Settings({ readPreference: () => 'TrUe' }).getDelayedBranchingEnabled()).toBe(true);
		expect(new Settings({ readPreference: () => 'FaLsE' }).getExtendedAssemblerEnabled()).toBe(
			false
		);
	});
	it('preserves all boolean defaults, nonpersistent setters, change notifications, and engine limits', () => {
		const fixture = readOracleJson('settings-units/golden.json') as {
			stdout: string;
			stderr: string;
			status: number;
		};
		expect(fixture.status).toBe(0);
		expect(fixture.stderr).toBe('');
		const saved = new Map<string, string>();
		const settings = new Settings({ writePreference: (key, value) => saved.set(key, value) });
		let notices = 0;
		settings.subscribe(() => {
			notices++;
		});
		const actual = [
			`limits\t${Globals.maximumErrorMessages}\t${Globals.maximumMessageCharacters}\t${Globals.maximumBacksteps}`
		];
		for (let id = 0; id < 21; id++) {
			const initial = settings.getBooleanSetting(id);
			settings.setBooleanSettingNonPersistent(id, !initial);
			const silent = notices;
			settings.setBooleanSetting(id, initial);
			const once = notices;
			settings.setBooleanSetting(id, initial);
			actual.push(`boolean\t${id}\t${initial}\t${silent}\t${once}\t${notices}`);
		}
		actual.push(
			`strings\t${settings.getExceptionHandler()}\t${settings.getMemoryConfiguration()}\t${settings.getLabelSortState()}`,
			`backstep\t${settings.getBackSteppingEnabled()}`
		);
		for (const id of [-1, 21])
			try {
				settings.getBooleanSetting(id);
			} catch (error) {
				actual.push(`invalid\t${(error as Error).message}`);
			}
		expect(actual.join('\n') + '\n').toBe(fixture.stdout);
		expect(saved.size).toBe(21);
	});
	it('keeps preference persistence and observer teardown session-owned', () => {
		const saved = new Map([['DelayedBranching', 'true']]);
		const settings = new Settings({
			readPreference: (key) => saved.get(key) ?? null,
			writePreference: (key, value) => saved.set(key, value)
		});
		const order: number[] = [];
		settings.subscribe(() => order.push(1));
		const release = settings.subscribe(() => order.push(2));
		expect(settings.getDelayedBranchingEnabled()).toBe(true);
		settings.setBooleanSetting(Settings.DELAYED_BRANCHING_ENABLED, false);
		expect(order).toEqual([2, 1]);
		release();
		settings.setBooleanSetting(Settings.DELAYED_BRANCHING_ENABLED, true);
		expect(order).toEqual([2, 1, 1]);
		settings.setBooleanSettingNonPersistent(Settings.DELAYED_BRANCHING_ENABLED, false);
		settings.reset();
		expect(settings.getDelayedBranchingEnabled()).toBe(true);
	});
});

describe('production Globals and Venus RunController', () => {
	it('assembles, steps, undoes register and memory writes, resumes at breakpoints, and resets retained sources', async () => {
		const item = session('addiu $t0,$0,5\naddiu $t0,$t0,1\nsw $t0,0($gp)\nli $v0,10\nsyscall');
		const { controller, globals } = item;
		const revisions: number[] = [];
		const release = controller.subscribe((state) => revisions.push(state.revision));
		controller.assemble(['main.asm'], 'main.asm');
		const base = globals.memory.textBaseAddress,
			gp = globals.registerFile.getValue(28);
		expect(controller.getState().statements).toHaveLength(5);
		expect(globals.getSettings().getBackSteppingEnabled()).toBe(true);
		await controller.step();
		expect(globals.registerFile.getValue(8)).toBe(5);
		expect(globals.registerFile.getProgramCounter()).toBe(base + 4);
		controller.backStep();
		expect(globals.registerFile.getValue(8)).toBe(0);
		expect(globals.registerFile.getProgramCounter()).toBe(base);
		await controller.run([base + 8]);
		expect(controller.getState().reason).toBe(Simulator.BREAKPOINT);
		expect(globals.registerFile.getValue(8)).toBe(6);
		await controller.step();
		expect(globals.memory.getWord(gp)).toBe(6);
		controller.backStep();
		expect(globals.memory.getWord(gp)).toBe(0);
		expect(globals.registerFile.getProgramCounter()).toBe(base + 8);
		await controller.run();
		expect(controller.getState().status).toBe('terminated');
		expect(controller.getState().reason).toBe(Simulator.NORMAL_TERMINATION);
		item.files.set('main.asm', 'addiu $t0,$0,9');
		controller.reset();
		await controller.step();
		expect(globals.registerFile.getValue(8)).toBe(5);
		controller.assemble(['main.asm'], 'main.asm');
		await controller.step();
		expect(globals.registerFile.getValue(8)).toBe(9);
		expect(revisions.length).toBeGreaterThan(15);
		release();
		await controller.dispose();
		expect(() => controller.step()).toThrow('disposed');
	});
	it('selects supplied open buffers, preserves lead identity, and keeps machines independent', async () => {
		const first = session('.globl main\nmain:nop'),
			second = session('addiu $t0,$0,2');
		first.files.set('other.asm', '.globl other\nother:nop');
		first.globals.getSettings().setBooleanSetting(Settings.ASSEMBLE_ALL_ENABLED, true);
		first.controller.assemble(['other.asm', 'main.asm'], 'main.asm');
		second.controller.assemble(['main.asm'], 'main.asm');
		expect(first.controller.getState().programs[0]).toBe(first.globals.program);
		expect(first.controller.getState().statements).toHaveLength(2);
		expect(second.controller.getState().statements).toHaveLength(1);
		await second.controller.step();
		expect(second.globals.registerFile.getValue(8)).toBe(2);
		expect(first.globals.registerFile.getValue(8)).toBe(0);
		const count = first.globals.instructionSet.getInstructionList().length;
		first.globals.initialize();
		expect(first.globals.instructionSet.getInstructionList()).toHaveLength(count);
		first.controller.invalidate();
		expect(first.controller.getState().status).toBe('idle');
		expect(() => first.controller.run()).toThrow('assembled');
		await first.controller.dispose();
		await second.controller.dispose();
	}, 15000);
	it('uses global main and canonical memory-layout resets', async () => {
		const item = session('nop\n.globl main\nmain:nop');
		item.globals.getSettings().setBooleanSetting(Settings.START_AT_MAIN, true);
		item.controller.assemble(['main.asm'], 'main.asm');
		expect(item.globals.registerFile.getProgramCounter()).toBe(
			item.globals.memory.textBaseAddress + 4
		);
		item.files.set('main.asm', 'nop\nmain:nop');
		item.controller.assemble(['main.asm'], 'main.asm');
		expect(item.globals.registerFile.getProgramCounter()).toBe(item.globals.memory.textBaseAddress);
		const compact = item.globals.memoryConfigurations.getConfigurationByName('CompactDataAtZero')!;
		item.globals.memoryConfigurations.setCurrentConfiguration(compact);
		expect(item.globals.registerFile.getValue(29)).toBe(compact.getStackPointer());
		expect(item.globals.memory.textBaseAddress).toBe(compact.getTextBaseAddress());
		await item.controller.dispose();
	});
	it('preserves canonical invalid-input diagnostics when Stop releases an empty pending read', async () => {
		let entered!: () => void;
		const ready = new Promise<void>((resolve) => {
			entered = resolve;
		});
		let release!: (text: string) => void;
		const item = session('li $v0,5\nsyscall\naddiu $t0,$0,99', {
			readInput: () => {
				entered();
				return new Promise<string>((resolve) => {
					release = resolve;
				});
			},
			releaseInput: () => release('')
		});
		item.controller.assemble(['main.asm'], 'main.asm');
		const running = item.controller.run();
		await ready;
		expect(() => item.controller.reset()).toThrow('Pause or stop');
		item.controller.stop();
		await running;
		expect(item.controller.getState().status).toBe('error');
		expect(item.controller.getState().error).toBeInstanceOf(ProcessingException);
		expect(item.controller.getState().error!.errors()!.generateErrorReport()).toContain(
			'invalid integer input'
		);
		expect(item.globals.registerFile.getValue(8)).toBe(0);
		await item.controller.dispose();
	});
	it('marks explicit synchronous GUI edits while asynchronous input owns the simulator', async () => {
		let entered!: () => void;
		const ready = new Promise<void>((resolve) => {
			entered = resolve;
		});
		let release!: (text: string) => void;
		const item = session('li $v0,5\nsyscall', {
			readInput: () => {
				entered();
				return new Promise<string>((resolve) => {
					release = resolve;
				});
			}
		});
		item.controller.assemble(['main.asm'], 'main.asm');
		const origins: string[] = [];
		const unsubscribe = item.globals.registerFile
			.getRegisters()[8]
			.subscribe((notice) => origins.push(notice.getOrigin()));
		const running = item.controller.run();
		await ready;
		item.globals.withGuiAccess(() => item.globals.registerFile.updateRegister(8, 10));
		expect(origins.at(-1)).toBe('gui');
		release('12');
		await running;
		expect(item.globals.registerFile.getValue(2)).toBe(12);
		unsubscribe();
		await item.controller.dispose();
	});
	it('reserves execution before publishing and closes synchronously during disposal', async () => {
		const item = session('nop');
		item.controller.assemble(['main.asm'], 'main.asm');
		let guarded = 0;
		const unsubscribe = item.controller.subscribe((state) => {
			if (state.status === 'running') {
				expect(() => item.controller.reset()).toThrow('Pause or stop');
				expect(() => item.controller.step()).toThrow('Pause or stop');
				guarded++;
			}
		});
		await item.controller.step();
		expect(guarded).toBeGreaterThan(0);
		unsubscribe();
		const disposal = item.controller.dispose();
		expect(item.controller.dispose()).toBe(disposal);
		expect(() => item.controller.run()).toThrow('disposed');
		await disposal;
	});
	it('preserves preference objects with prototype methods and receiver-owned state', async () => {
		class Preferences {
			readonly values = new Map([['DelayedBranching', 'true']]);
			readPreference(key: string): string | null {
				return this.values.get(key) ?? null;
			}
			writePreference(key: string, value: string): void {
				this.values.set(key, value);
			}
		}
		const preferences = new Preferences();
		const item = session('nop', { preferences });
		expect(item.globals.getSettings().getDelayedBranchingEnabled()).toBe(true);
		item.globals.getSettings().setBooleanSetting(Settings.DELAYED_BRANCHING_ENABLED, false);
		expect(preferences.values.get('DelayedBranching')).toBe('false');
		await item.controller.dispose();
	});
});
