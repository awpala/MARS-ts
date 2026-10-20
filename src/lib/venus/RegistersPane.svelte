<script lang="ts">
	/**
	 * Ports mars/venus/RegistersPane.java, RegistersWindow.java,
	 * Coprocessor0Window.java, and Coprocessor1Window.java.
	 * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
	 */
	import type { RegisterFile } from '#lib/engine/hardware/RegisterFile.js';
	import type { Coprocessor0 } from '#lib/engine/hardware/Coprocessor0.js';
	import type { Coprocessor1 } from '#lib/engine/hardware/Coprocessor1.js';
	import { AccessNotice } from '#lib/engine/hardware/AccessNotice.js';
	import { Binary } from '#lib/engine/formatting/Binary.js';
	import { JavaFloatingPoint } from '#lib/engine/formatting/JavaFloatingPoint.js';
	import highlightingPreset from './highlighting-preset.json';
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
		return hexValues ? Binary.intToHexString(value) : String(unsigned ? value >>> 0 : value);
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
	const conditionFlags = $derived.by(() => {
		void machineRevision;
		return coprocessor1.getConditionFlagsNoNotify();
	});
</script>

<!-- @component Persistent registers sidebar, reading engine-owned hardware and releasing subscriptions on teardown. -->
<aside
	{id}
	aria-label="Registers"
	class="register-pane"
	style:--table-font={highlightingPreset.fontFamily}
	style:--table-font-size={highlightingPreset.fontSize}
	style:--even-background={highlightingPreset.evenRow.background}
	style:--even-foreground={highlightingPreset.evenRow.foreground}
	style:--odd-background={highlightingPreset.oddRow.background}
	style:--odd-foreground={highlightingPreset.oddRow.foreground}
	style:--changed-background={highlightingPreset.registers.background}
	style:--changed-foreground={highlightingPreset.registers.foreground}
>
	<div class="tabs">
		{#each ['Registers', 'Coproc 1', 'Coproc 0'] as tab (tab)}<button
				class:active={selected === tab}
				aria-pressed={selected === tab}
				onclick={() => (selected = tab)}>{tab}</button
			>{/each}
	</div>
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
						class:changed={highlightingPreset.registers.enabled && changed === row.name}
						><td>{row.name}</td>{#if selected === 'Coproc 1'}<td
								><input
									aria-label={`${row.name} float value`}
									value={floatValue(row.number)}
									readonly={running}
									onchange={(event) => updateFloat(row.number, false, event.currentTarget)}
									onkeydown={(event) => {
										if (event.key === 'Enter') event.currentTarget.blur();
									}}
								/></td
							><td
								>{#if row.number % 2 === 0}<input
										aria-label={`${row.name} double value`}
										value={doubleValue(row.number)}
										readonly={running}
										onchange={(event) => updateFloat(row.number, true, event.currentTarget)}
										onkeydown={(event) => {
											if (event.key === 'Enter') event.currentTarget.blur();
										}}
									/>{/if}</td
							>{:else}<td>{row.number < 32 ? row.number : ''}</td><td
								><input
									aria-label={`${row.name} value`}
									value={format(row.value, selected === 'Registers' && row.number === 32)}
									readonly={running ||
										(selected === 'Registers' && [0, 31, 32].includes(row.number))}
									onchange={(event) => update(row.number, event.currentTarget)}
									onkeydown={(event) => {
										if (event.key === 'Enter') event.currentTarget.blur();
									}}
								/></td
							>{/if}</tr
					>{/each}
			</tbody>
		</table>
	</div>
	{#if selected === 'Coproc 1'}<div class="flags">
			<div class="flags-caption">Condition flags</div>
			<div class="flag-controls">
				{#each Array.from({ length: coprocessor1.getConditionFlagCount() }, (_, i) => i) as flag (flag)}<label
						><input
							type="checkbox"
							aria-label={`Condition flag ${flag}`}
							disabled
							checked={Binary.bitValue(conditionFlags, flag) === 1}
						/><span>{flag}</span></label
					>{/each}
			</div>
		</div>{/if}
	{#if error}<p role="alert">{error}</p>{/if}
</aside>

<style>
	.register-pane {
		display: flex;
		flex-direction: column;
		flex: 0 0 auto;
		min-width: 260px;
		width: var(--register-width, 310px);
		overflow: auto;
		border: 1px solid #8d969e;
		background: #fafafa;
	}
	.tabs {
		display: flex;
		gap: 2px;
		padding: 2px 3px 0;
		background: #e4e4e4;
		border-bottom: 1px solid #9ca7b0;
		flex-shrink: 0;
	}
	.tabs button {
		white-space: nowrap;
		padding: 4px 9px;
		border: 1px solid #a6aeb5;
		border-bottom: 0;
		border-radius: 3px 3px 0 0;
	}
	.tabs button.active {
		background: white;
		font-weight: 600;
	}
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
		background: #e5e5e5;
		font-weight: 400;
	}
	th,
	td {
		border: 1px solid #c5c5c5;
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
		outline: 1px solid #467ca8;
		background: #fff;
	}
	.flags {
		padding: 5px;
	}
	.flags-caption {
		margin-bottom: 5px;
	}
	.flag-controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.flags label {
		display: flex;
		align-items: center;
		gap: 3px;
	}
	.flags input {
		min-width: 0;
		width: auto;
	}
	p {
		color: #a11;
		padding: 5px;
	}
	@media print {
		.register-pane {
			display: none;
		}
	}
</style>
