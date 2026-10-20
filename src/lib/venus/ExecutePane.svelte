<script lang="ts">
	/** Ports the views in mars/venus/TextSegmentWindow.java, DataSegmentWindow.java, and LabelsWindow.java.
	 * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license. */
	import { asset } from '$app/paths';
	import type { Globals } from '#lib/engine/Globals.js';
	import { Settings } from '#lib/engine/Settings.js';
	import { AddressErrorException } from '#lib/engine/hardware/AddressErrorException.js';
	import { AccessNotice } from '#lib/engine/hardware/AccessNotice.js';
	import { Binary, NumberFormatException } from '#lib/engine/formatting/Binary.js';
	import type { RunController } from './RunController.js';
	import preset from './highlighting-preset.json';
	/** Execution tables render the parent-owned machine without owning simulation snapshot. */
	type Props = {
		/** Required initialized machine; all reads use its public, nonnotifying interfaces. */
		machine: Globals;
		/** Required controller snapshot; revision invalidates views after machine changes. */
		snapshot: ReturnType<RunController['getState']>;
		/** Required breakpoint addresses owned by the desktop. */
		breakpoints: readonly number[];
		/** Required callback toggles a breakpoint in the desktop. */
		ontogglebreakpoint: (address: number) => void;
		/** Required callback refreshes controller state after a manual memory edit. */
		onedit: () => void;
		/** Required callback opens the corresponding source location. */
		onsource: (filename: string, line: number) => void;
		/** Whether to show labels, controlled by Settings. */
		showLabels: boolean;
		/** Parent-owned persisted inclusion of data labels; toggled inside the Labels panel. */
		showDataLabels: boolean;
		/** Parent-owned persisted inclusion of text labels; toggled inside the Labels panel. */
		showTextLabels: boolean;
		/** Parent-owned LabelsWindow sort state, integer zero through seven. */
		labelSortState: number;
		/** Parent-owned address display base, bindable through the bottom checkbox. */
		hexAddresses: boolean;
		/** Parent-owned value display base, bindable through the bottom checkbox. */
		hexValues: boolean;
		/** Parent-owned persisted ASCII display setting, shared by checkbox and toolbar toggle. */
		ascii: boolean;
	};
	let {
		machine,
		snapshot,
		breakpoints,
		ontogglebreakpoint,
		onedit,
		onsource,
		showLabels,
		showDataLabels = $bindable(),
		showTextLabels = $bindable(),
		labelSortState = $bindable(),
		hexAddresses = $bindable(),
		hexValues = $bindable(),
		ascii = $bindable()
	}: Props = $props();
	let segment = $state('data');
	let pageOffset = $state(0);
	let memoryError = $state('');
	let editedAddress = $state<number | null>(null);
	const memoryRows = 16;
	const memoryPageBytes = memoryRows * 32;
	// LabelsWindow remembers the direction of each column when switching sort columns.
	const sortTransitions = [
		[4, 1],
		[5, 0],
		[6, 3],
		[7, 2],
		[6, 0],
		[7, 1],
		[4, 2],
		[5, 3]
	];
	const sortColumn = $derived(labelSortState < 4 ? 1 : 0);
	const sortDescending = $derived((labelSortState & (sortColumn === 0 ? 2 : 1)) !== 0);
	$effect(() =>
		machine.memory.addObserver((notice) => {
			if (notice.getAccessType() === AccessNotice.WRITE) editedAddress = notice.getAddress() & ~3;
		})
	);
	const selfModifying = $derived.by(() => {
		void snapshot.revision;
		return machine.getSettings().getBooleanSetting(Settings.SELF_MODIFYING_CODE_ENABLED);
	});
	const running = $derived(snapshot.status === 'running');
	const pc = $derived.by(() => {
		void snapshot.revision;
		const current = machine.registerFile.getProgramCounterRegister().getValueNoNotify();
		return snapshot.error ? (current - 4) | 0 : current;
	});
	const delaySlot = $derived.by(() => {
		void snapshot.revision;
		return machine.delayedBranch.isTriggered();
	});
	const rows = $derived.by(() => {
		void snapshot.revision;
		void hexAddresses;
		void hexValues;
		return snapshot.statements.map((original) => {
			const address = original.getAddress();
			const live = machine.memory.getStatementNoNotify(address) ?? original;
			return {
				address,
				code: live.getBinaryStatement(),
				basic: live.getPrintableBasicAssemblyStatement(),
				source: original.getSource(),
				modified: live.getBinaryStatement() !== original.getBinaryStatement(),
				line: original.getSourceLine(),
				filename: original.getSourceFile() ?? ''
			};
		});
	});
	const labels = $derived.by(() => {
		void snapshot.revision;
		return [
			...machine.symbolTable.getAllSymbols().map((symbol) => ({ symbol, file: 'Global' })),
			...snapshot.programs.flatMap((program) =>
				(program.getLocalSymbolTable()?.getAllSymbols() ?? []).map((symbol) => ({
					symbol,
					file: program.getFilename() ?? ''
				}))
			)
		]
			.filter(({ symbol }) => (symbol.getType() ? showDataLabels : showTextLabels))
			.sort((left, right) => {
				const a = sortDescending ? right.symbol : left.symbol;
				const b = sortDescending ? left.symbol : right.symbol;
				if (sortColumn === 1) return (a.getAddress() >>> 0) - (b.getAddress() >>> 0);
				const nameA = a.getName().toLowerCase(),
					nameB = b.getName().toLowerCase();
				return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
			});
	});
	const memoryBases = $derived.by(() => {
		void snapshot.revision;
		const memory = machine.memory;
		const bases: Record<string, number> = {
			data: memory.dataBaseAddress,
			extern: memory.externBaseAddress,
			heap: memory.heapBaseAddress,
			gp: machine.registerFile.getRegisters()[28].getValueNoNotify(),
			sp: machine.registerFile.getRegisters()[29].getValueNoNotify(),
			text: memory.textBaseAddress,
			kernel: memory.kernelDataBaseAddress,
			mmio: memory.memoryMapBaseAddress
		};
		return bases;
	});
	const memoryBase = $derived(((memoryBases[segment] & ~3) + pageOffset) | 0);
	const dataRows = $derived.by(() => {
		void snapshot.revision;
		return Array.from({ length: memoryRows }, (_, row) => {
			const address = (memoryBase + row * 32) | 0;
			return {
				address,
				words: Array.from({ length: 8 }, (_, column) => {
					const location = (address + column * 4) | 0;
					return { address: location, value: readWord(location) };
				})
			};
		});
	});
	function formatAddress(address: number) {
		return hexAddresses ? Binary.intToHexString(address) : String(address >>> 0);
	}
	function readWord(address: number): number {
		return machine.withGuiAccess(() => {
			try {
				return machine.memory.getWordNoNotify(address);
			} catch (error) {
				if (!(error instanceof AddressErrorException)) throw error;
				// DataSegmentWindow temporarily enables text reads solely for display.
				const settings = machine.getSettings();
				const enabled = settings.getBooleanSetting(Settings.SELF_MODIFYING_CODE_ENABLED);
				if (machine.memory.inTextSegment(address) && !enabled) {
					settings.setBooleanSettingNonPersistent(Settings.SELF_MODIFYING_CODE_ENABLED, true);
					try {
						return machine.memory.getWordNoNotify(address);
					} catch (readError) {
						if (!(readError instanceof AddressErrorException)) throw readError;
					} finally {
						settings.setBooleanSettingNonPersistent(Settings.SELF_MODIFYING_CODE_ENABLED, enabled);
					}
				}
				return 0;
			}
		});
	}
	function formatWord(value: number) {
		return ascii
			? Binary.intToAscii(value)
			: hexValues
				? Binary.intToHexString(value)
				: String(value);
	}
	function changeWord(address: number, input: HTMLInputElement, code = false) {
		try {
			machine.withGuiAccess(() =>
				machine.memory.setRawWord(address, Binary.stringToInt(input.value.trim()))
			);
			editedAddress = address;
			memoryError = '';
			onedit();
		} catch (error) {
			if (error instanceof NumberFormatException) {
				input.value = 'INVALID';
				return;
			}
			memoryError = error instanceof Error ? error.message : String(error);
		}
		input.value = code ? Binary.intToHexString(readWord(address)) : formatWord(readWord(address));
	}
	function navigateLabel(address: number) {
		if (machine.memory.inTextSegment(address) || machine.memory.inKernelTextSegment(address)) {
			document
				.getElementById(`${id}-instruction-${address >>> 0}`)
				?.scrollIntoView({ block: 'nearest' });
		} else {
			segment = 'data';
			pageOffset = (address & ~31) - machine.memory.dataBaseAddress;
		}
	}
	const id = $props.id();
	function followPC(node: HTMLElement) {
		const viewport = node.closest<HTMLElement>('.text-segment');
		if (!viewport) return;
		const headerHeight = viewport.querySelector('thead')?.getBoundingClientRect().height ?? 0;
		// Keep the current row below the sticky headings; scrollTop clamps at the last page.
		// Scroll only this pane, preserving horizontal position and keyboard focus.
		viewport.scrollTop +=
			node.getBoundingClientRect().top -
			viewport.getBoundingClientRect().top -
			viewport.clientTop -
			headerHeight;
	}
</script>

<!-- @component Actual assembled statements, breakpoints, symbol navigation, and editable paged memory for the session. -->
<div
	class="execute-pane"
	style:--table-font={preset.fontFamily}
	style:--table-font-size={preset.fontSize}
	style:--pc-background={preset.text.background}
	style:--pc-foreground={preset.text.foreground}
	style:--changed-background={preset.data.background}
	style:--delay-background={preset.delaySlot.background}
	style:--delay-foreground={preset.delaySlot.foreground}
	style:--even-background={preset.evenRow.background}
	style:--even-foreground={preset.evenRow.foreground}
	style:--odd-background={preset.oddRow.background}
	style:--odd-foreground={preset.oddRow.foreground}
>
	<div class="text-row">
		<section class="segment text-segment" aria-label="Text Segment">
			<h2>Text Segment</h2>
			<table>
				<thead
					><tr
						>{#each ['Bkpt', 'Address', 'Code', 'Basic', 'Source'] as heading (heading)}<th
								>{heading}</th
							>{/each}</tr
					></thead
				><tbody>
					{#each rows as row (row.address)}<tr
							{@attach row.address === pc && followPC}
							id={`${id}-instruction-${row.address >>> 0}`}
							class={{ current: row.address === pc, delay: row.address === pc && delaySlot }}
							aria-current={row.address === pc ? 'step' : undefined}
						>
							<td
								><input
									type="checkbox"
									aria-label={`Breakpoint ${Binary.intToHexString(row.address)}`}
									checked={breakpoints.includes(row.address)}
									disabled={running}
									onchange={() => ontogglebreakpoint(row.address)}
								/></td
							>
							<td>{formatAddress(row.address)}</td><td
								><input
									class="code-value"
									aria-label={`Code ${Binary.intToHexString(row.address)}`}
									value={Binary.intToHexString(row.code)}
									readonly={running || !selfModifying}
									onchange={(event) => changeWord(row.address, event.currentTarget, true)}
									onkeydown={(event) => {
										if (event.key === 'Enter') event.currentTarget.blur();
									}}
								/></td
							><td>{row.basic}</td>
							<td
								>{#if row.modified}<span> ------ </span>{:else}<button
										class="source-link"
										title={row.filename}
										onclick={() => onsource(row.filename, row.line)}
										>{row.line}: {row.source}</button
									>{/if}</td
							>
						</tr>{/each}
				</tbody>
			</table>
		</section>
		{#if showLabels}<section class="labels segment" aria-label="Labels">
				<h2>Labels</h2>
				<div class="label-controls">
					<label title="Show labels defined in the data segment"
						><input type="checkbox" bind:checked={showDataLabels} /> Data</label
					>
					<label title="Show labels defined in the text segment"
						><input type="checkbox" bind:checked={showTextLabels} /> Text</label
					>
				</div>
				<table>
					<thead
						><tr
							>{#each ['Label', 'Address'] as heading, column (heading)}
								<th
									aria-sort={sortColumn === column
										? sortDescending
											? 'descending'
											: 'ascending'
										: 'none'}
								>
									<button
										aria-label={`Sort by ${heading}`}
										title={`Sort by ${heading}`}
										onclick={() => (labelSortState = sortTransitions[labelSortState][column])}
									>
										{heading}{#if sortColumn === column}<span aria-hidden="true">
												{sortDescending ? '▼' : '▲'}</span
											>{/if}
									</button>
								</th>
							{/each}</tr
						></thead
					><tbody
						>{#each labels as label (`${label.file}:${label.symbol.getName()}`)}<tr
								><td
									><button
										title={label.file}
										onclick={() => navigateLabel(label.symbol.getAddress())}
										>{label.symbol.getName()}</button
									></td
								><td>{formatAddress(label.symbol.getAddress())}</td></tr
							>{/each}</tbody
					>
				</table>
			</section>{/if}
	</div>
	<section class="segment data-segment" aria-label="Data Segment">
		<h2>Data Segment</h2>
		<div class="data-scroll">
			<table>
				<thead
					><tr
						><th>Address</th
						>{#each Array.from({ length: 8 }, (_, i) => i * 4) as offset (offset)}<th
								>Value (+{offset})</th
							>{/each}</tr
					></thead
				><tbody
					>{#each dataRows as row (row.address)}<tr
							><td>{formatAddress(row.address)}</td>{#each row.words as word (word.address)}<td
									class={{ changed: preset.data.enabled && word.address === editedAddress }}
									><input
										aria-label={`Memory ${Binary.intToHexString(word.address)}`}
										value={formatWord(word.value)}
										readonly={running || ascii}
										onchange={(event) => changeWord(word.address, event.currentTarget)}
										onkeydown={(event) => {
											if (event.key === 'Enter') event.currentTarget.blur();
										}}
									/></td
								>{/each}</tr
						>{/each}</tbody
				>
			</table>
		</div>
		<div class="data-controls">
			<button aria-label="Previous memory page" onclick={() => (pageOffset -= memoryPageBytes)}
				><img src={asset('icons/Previous.svg')} alt="" /></button
			><select
				aria-label="Data segment base"
				bind:value={segment}
				onchange={() => {
					pageOffset = 0;
				}}
				><option value="extern">{Binary.intToHexString(memoryBases.extern)} (.extern)</option>
				<option value="data">{Binary.intToHexString(memoryBases.data)} (.data)</option>
				<option value="heap">{Binary.intToHexString(memoryBases.heap)} (heap)</option>
				<option value="gp">current $gp</option><option value="sp">current $sp</option>
				<option value="text">{Binary.intToHexString(memoryBases.text)} (.text)</option>
				<option value="kernel">{Binary.intToHexString(memoryBases.kernel)} (.kdata)</option>
				<option value="mmio">{Binary.intToHexString(memoryBases.mmio)} (MMIO)</option></select
			><button aria-label="Next memory page" onclick={() => (pageOffset += memoryPageBytes)}
				><img src={asset('icons/Next.svg')} alt="" /></button
			>
			<div class="control-separator" role="separator" aria-orientation="vertical"></div>
			<div class="display-options">
				<label><input type="checkbox" bind:checked={hexAddresses} /> Hexadecimal Addresses</label>
				<label><input type="checkbox" bind:checked={hexValues} /> Hexadecimal Values</label>
				<label><input type="checkbox" bind:checked={ascii} /> ASCII</label>
			</div>
		</div>
		{#if memoryError}<p role="alert">{memoryError}</p>{/if}
	</section>
</div>

<style>
	.execute-pane {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: auto;
	}
	.text-row {
		display: flex;
		flex: 1 0 100px;
		min-height: 100px;
	}
	.segment {
		flex: 1;
		overflow: auto;
		border: 1px solid #a2aab1;
		min-height: 0;
		min-width: 0;
	}
	h2 {
		background: #dde4eb;
		border-bottom: 1px solid #a2aab1;
		padding: 3px 6px;
		font-weight: 600;
	}
	.labels {
		flex: 0 0 25%;
	}
	.label-controls {
		display: flex;
		gap: 12px;
		padding: 3px 6px;
		background: #eee;
	}
	.labels th button {
		width: 100%;
		text-align: left;
	}
	table {
		border-collapse: collapse;
		width: 100%;
		font: var(--table-font-size) var(--table-font);
		white-space: nowrap;
	}
	th {
		position: sticky;
		top: 0;
		background: #e5e5e5;
		font-weight: 400;
	}
	th,
	td {
		border: 1px solid #bbb;
		padding: 2px 4px;
	}
	tbody tr:nth-child(odd) {
		background: var(--even-background);
		color: var(--even-foreground);
	}
	tbody tr:nth-child(even) {
		background: var(--odd-background);
		color: var(--odd-foreground);
	}
	tbody tr.current {
		background: var(--pc-background);
		color: var(--pc-foreground);
	}
	tbody tr.current.delay {
		background: var(--delay-background);
		color: var(--delay-foreground);
	}
	.source-link {
		text-align: left;
		white-space: pre;
	}
	.data-segment {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
	}
	.data-scroll {
		overflow: auto;
	}
	.code-value,
	.data-scroll input {
		width: 100px;
		border: 0;
		background: transparent;
		font: inherit;
	}
	.code-value:focus,
	.data-scroll input:focus {
		outline: 1px solid #467ca8;
		background: white;
	}
	td.changed {
		background: var(--changed-background);
	}
	.data-controls {
		display: flex;
		gap: 10px;
		align-items: center;
		overflow-x: auto;
		background: #eee;
		flex-shrink: 0;
		padding: 2px 5px;
	}
	.data-controls > button,
	.data-controls > select {
		flex-shrink: 0;
	}
	.control-separator {
		flex: 0 0 1px;
		align-self: stretch;
		margin: 2px 0;
		background: #b3b3b3;
	}
	.data-controls img {
		width: 22px;
		height: 22px;
	}
	.display-options {
		display: flex;
		flex-shrink: 0;
		white-space: nowrap;
		gap: 15px;
	}
	p {
		color: #a11;
		padding: 4px;
	}
</style>
