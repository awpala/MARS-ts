<script lang="ts">
	import MultiSelect from '../controls/MultiSelect.svelte';
	import TabbedPane from '../layout/TabbedPane.svelte';
	import { formatInteger, commitOnEnter } from '../../utils/tableCells.js';
	/**
	 * Ports mars/venus/RegistersPane.java, RegistersWindow.java,
	 * Coprocessor0Window.java, and Coprocessor1Window.java.
	 * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
	 */
	import type { RegisterFile } from '#lib/engine/hardware/registers/RegisterFile.js';
	import type { Coprocessor0 } from '#lib/engine/hardware/registers/Coprocessor0.js';
	import type { Coprocessor1 } from '#lib/engine/hardware/registers/Coprocessor1.js';
	import { AccessNotice } from '#lib/engine/hardware/notices/AccessNotice.js';
	import { Binary } from '#lib/engine/formatting/Binary.js';
	import { JavaFloatingPoint } from '#lib/engine/formatting/JavaFloatingPoint.js';
	import highlightingPreset from '../../highlighting-preset.json';
	/** Register display contract; the parent session owns all hardware instances. */
	type Props = {
		/** Optional parent-owned pane ID, used by the resize separator to identify its controlled region. */
		id?: string;
		/** Parent-controlled tab; execution errors select Coproc 0 and Reset selects Registers. */
		selected: string;
		/** Required display base from the containing IDE; true shows hexadecimal words. */
		hexValues: boolean;
		/** Required session-owned general registers; never replaced while a run is active. */
		registers: RegisterFile;
		/** Required session-owned exception registers. */
		coprocessor0: Coprocessor0;
		/** Required session-owned floating-point registers. */
		coprocessor1: Coprocessor1;
		/** Required refresh sequence for silent resets and condition flag changes. */
		machineRevision: number;
		/** True while executing; editing resumes at a paused or stepped boundary. */
		running: boolean;
		/** Notify the session after a manual register edit. */
		onedit: () => void;
	};
	let {
		hexValues,
		id,
		selected = $bindable(),
		registers,
		coprocessor0,
		coprocessor1,
		machineRevision,
		running,
		onedit
	}: Props = $props();
	const general = $derived([
		...registers.getRegisters(),
		registers.getProgramCounterRegister(),
		registers.getHighOrderRegister(),
		registers.getLowOrderRegister()
	]);
	let revision = $state(0);
	let error = $state('');
	let changed = $state('');
	const rows = $derived.by(() => {
		void revision;
		void machineRevision;
		return (
			selected === 'Registers'
				? general
				: selected === 'Coproc 0'
					? coprocessor0.getRegisters()
					: coprocessor1.getRegisters()
		).map((register) => ({
			name: register.getName(),
			number: register.getNumber(),
			value: register.getValueNoNotify()
		}));
	});
	$effect(() => {
		const releases = [
			...general,
			...coprocessor0.getRegisters(),
			...coprocessor1.getRegisters()
		].map((register) =>
			register.subscribe((notice) => {
				if (notice.getAccessType() === AccessNotice.WRITE) {
					if (register !== registers.getProgramCounterRegister()) changed = register.getName();
					revision++;
				}
			})
		);
		return () => releases.forEach((release) => release());
	});
	function format(value: number, unsigned = false) {
		return formatInteger(value, hexValues, unsigned);
	}
	function update(number: number, input: HTMLInputElement) {
		try {
			const value = Binary.stringToInt(input.value.trim());
			if (selected === 'Registers') registers.updateRegister(number, value);
			else coprocessor0.updateRegister(number, value);
			error = '';
			onedit();
		} catch {
			error = 'Invalid 32-bit integer. Use decimal or a hexadecimal value beginning with 0x.';
		}
		input.value = format(
			selected === 'Registers'
				? general.find((register) => register.getNumber() === number)!.getValueNoNotify()
				: coprocessor0
						.getRegisters()
						.find((register) => register.getNumber() === number)!
						.getValueNoNotify()
		);
	}
	function floatValue(number: number) {
		void revision;
		void machineRevision;
		return hexValues
			? Binary.intToHexString(coprocessor1.getRegisters()[number].getValueNoNotify())
			: JavaFloatingPoint.formatFloat(coprocessor1.getFloatFromRegisterNoNotify(number));
	}
	function doubleValue(number: number) {
		void revision;
		void machineRevision;
		return hexValues
			? Binary.longToHexString(
					Binary.twoIntsToLong(
						coprocessor1.getRegisters()[number + 1].getValueNoNotify(),
						coprocessor1.getRegisters()[number].getValueNoNotify()
					)
				)
			: JavaFloatingPoint.formatDouble(coprocessor1.getDoubleFromRegisterPairNoNotify(number));
	}
	function updateFloat(number: number, pair: boolean, input: HTMLInputElement) {
		try {
			const text = input.value.trim();
			if (pair) {
				if (Binary.isHex(text))
					coprocessor1.setRegisterPairToLong(number, Binary.stringToLong(text));
				else coprocessor1.setRegisterPairToDouble(number, JavaFloatingPoint.parseDouble(text));
			} else {
				if (Binary.isHex(text)) coprocessor1.updateRegister(number, Binary.stringToInt(text));
				else coprocessor1.setRegisterToFloat(number, JavaFloatingPoint.parseFloat(text));
			}
			error = '';
			onedit();
		} catch {
			error = 'Invalid floating-point value or hexadecimal bit pattern.';
		}
		input.value = pair ? doubleValue(number) : floatValue(number);
	}
	const conditionFlagOptions = $derived(
		Array.from({ length: coprocessor1.getConditionFlagCount() }, (_, flag) => ({
			value: flag,
			label: String(flag),
			accessibleLabel: `Condition flag ${flag}`
		}))
	);
	const conditionFlags = $derived.by(() => {
		void machineRevision;
		return coprocessor1.getConditionFlagsNoNotify();
	});
</script>

<!-- @component Persistent registers sidebar, reading engine-owned hardware and releasing subscriptions on teardown. -->
<TabbedPane
	element="aside"
	label="Registers"
	tabs={['Registers', 'Coproc 1', 'Coproc 0']}
	bind:selected
	--pane-flex="0 0 auto"
	--pane-min-width="260px"
	--pane-width="var(--register-width, 310px)"
	--pane-overflow="auto"
	--pane-background="var(--theme-surface, #fafafa)"
	--tab-padding="4px 9px"
	{id}
	class="register-pane"
	--table-font={highlightingPreset.fontFamily}
	--table-font-size={highlightingPreset.fontSize}
	--even-background={`var(--theme-row-even, ${highlightingPreset.evenRow.background})`}
	--even-foreground={`var(--theme-text, ${highlightingPreset.evenRow.foreground})`}
	--odd-background={`var(--theme-canvas, ${highlightingPreset.oddRow.background})`}
	--odd-foreground={`var(--theme-text, ${highlightingPreset.oddRow.foreground})`}
	--changed-background={`var(--theme-register-changed, ${highlightingPreset.registers.background})`}
	--changed-foreground={`var(--theme-text, ${highlightingPreset.registers.foreground})`}
>
	<div class="register-scroll">
		<table>
			<thead
				><tr
					><th>Name</th><th>{selected === 'Coproc 1' ? 'Float' : 'Number'}</th><th
						>{selected === 'Coproc 1' ? 'Double' : 'Value'}</th
					></tr
				></thead
			><tbody>
				{#each rows as row (row.number)}<tr
						class={{ changed: highlightingPreset.registers.enabled && changed === row.name }}
						><td>{row.name}</td>{#if selected === 'Coproc 1'}<td
								><input
									aria-label={`${row.name} float value`}
									value={floatValue(row.number)}
									readonly={running}
									onchange={(event) => updateFloat(row.number, false, event.currentTarget)}
									onkeydown={commitOnEnter}
								/></td
							><td
								>{#if row.number % 2 === 0}<input
										aria-label={`${row.name} double value`}
										value={doubleValue(row.number)}
										readonly={running}
										onchange={(event) => updateFloat(row.number, true, event.currentTarget)}
										onkeydown={commitOnEnter}
									/>{/if}</td
							>{:else}<td>{row.number < 32 ? row.number : ''}</td><td
								><input
									aria-label={`${row.name} value`}
									value={format(row.value, selected === 'Registers' && row.number === 32)}
									readonly={running ||
										(selected === 'Registers' && [0, 31, 32].includes(row.number))}
									onchange={(event) => update(row.number, event.currentTarget)}
									onkeydown={commitOnEnter}
								/></td
							>{/if}</tr
					>{/each}
			</tbody>
		</table>
	</div>
	{#if selected === 'Coproc 1'}
		<MultiSelect
			class="flags p-[5px] [--selector-gap:3px]"
			label="Condition flags"
			options={conditionFlagOptions}
			value={conditionFlagOptions
				.filter((option) => Binary.bitValue(conditionFlags, option.value) === 1)
				.map((option) => option.value)}
			disabled
		/>
	{/if}
	{#if error}<p role="alert">{error}</p>{/if}
</TabbedPane>

<style>
	.register-scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}
	table {
		border-collapse: collapse;
		width: 100%;
		font-size: var(--table-font-size);
	}
	th {
		position: sticky;
		top: 0;
		background: var(--theme-chrome, #e5e5e5);
		font-weight: 400;
	}
	th,
	td {
		border: 1px solid var(--theme-border, #c5c5c5);
		padding: 2px 5px;
		height: 21px;
		white-space: nowrap;
	}
	td {
		font-family: var(--table-font);
	}
	tbody tr:nth-child(odd) {
		background: var(--even-background);
		color: var(--even-foreground);
	}
	tbody tr:nth-child(even) {
		background: var(--odd-background);
		color: var(--odd-foreground);
	}
	tbody tr.changed {
		background: var(--changed-background);
		color: var(--changed-foreground);
	}
	input {
		width: 100%;
		min-width: 94px;
		border: 0;
		background: transparent;
		font: inherit;
	}
	input:focus {
		outline: 1px solid var(--theme-focus, #467ca8);
		background: var(--theme-canvas, #fff);
	}
	p {
		color: var(--theme-error, #a11);
		padding: 5px;
	}
</style>
