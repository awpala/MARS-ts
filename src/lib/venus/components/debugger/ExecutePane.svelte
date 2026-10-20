<script lang="ts">
	import SelectorToggle from '../controls/SelectorToggle.svelte';
	import Button from '../controls/Button.svelte';
	import Pane from '../layout/Pane.svelte';
	import { formatInteger, commitOnEnter } from '../../utils/tableCells.js';
	/** Ports the views in mars/venus/TextSegmentWindow.java, DataSegmentWindow.java, and LabelsWindow.java.
	 * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license. */
	import ToolbarIcon from '../shell/ToolbarIcon.svelte';
	import PaneDivider from '../layout/PaneDivider.svelte';
	import Tooltip from '../feedback/Tooltip.svelte';
	import type { Globals } from '#lib/engine/Globals.js';
	import { Settings } from '#lib/engine/Settings.js';
	import { AddressErrorException } from '#lib/engine/hardware/AddressErrorException.js';
	import { AccessNotice } from '#lib/engine/hardware/AccessNotice.js';
	import { Binary, NumberFormatException } from '#lib/engine/formatting/Binary.js';
	import type { RunController } from '../../RunController.js';
	import preset from '../../highlighting-preset.json';
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
		/** Parent-owned requested Data Segment height in pixels; null keeps its natural height. */
		dataHeight: number | null;
		/** Required callback persists the Data Segment height after a completed resize. */
		onresizecommit: () => void;
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
		ascii = $bindable(),
		dataHeight = $bindable(),
		onresizecommit
	}: Props = $props();
	let segment = $state('data');
	let pageOffset = $state(0);
	let memoryError = $state('');
	let editedAddress = $state<number | null>(null);
	const memoryRows = 16;
	const memoryPageBytes = memoryRows * 32;
	// The text row keeps its 100px minimum beside the 7px divider.
	const minTextHeight = 107;
	const minDataHeight = 60;
	let executeHeight = $state(0);
	let dataPaneHeight = $state(0);
	let dataScrollHeight = $state(0);
	let dataTableHeight = $state(0);
	let segmentSelect = $state<HTMLSelectElement>();
	// Compression changes only the scroll viewport, so this stays constant while resizing.
	const naturalDataHeight = $derived(dataPaneHeight - dataScrollHeight + dataTableHeight);
	const maxDataHeight = $derived(
		Math.max(minDataHeight, Math.min(naturalDataHeight, executeHeight - minTextHeight))
	);
	const displayedDataHeight = $derived(
		dataHeight === null
			? Math.min(dataPaneHeight, maxDataHeight)
			: Math.max(minDataHeight, Math.min(maxDataHeight, dataHeight))
	);
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
	const labelGroups = $derived.by(() => {
		void snapshot.revision;
		return [
			{
				owner: machine.symbolTable,
				file: '(global)',
				symbols: machine.symbolTable.getAllSymbols()
			},
			...snapshot.programs.map((program) => ({
				owner: program,
				file: program.getFilename() ?? '',
				symbols: program.getLocalSymbolTable()?.getAllSymbols() ?? []
			}))
		]
			.filter((group) => group.symbols.length > 0)
			.map((group) => ({
				...group,
				name: group.file.split(/[/\\]/).at(-1) ?? group.file,
				symbols: group.symbols
					.filter((symbol) => (symbol.getType() ? showDataLabels : showTextLabels))
					.sort((left, right) => {
						const a = sortDescending ? right : left;
						const b = sortDescending ? left : right;
						if (sortColumn === 1) return (a.getAddress() >>> 0) - (b.getAddress() >>> 0);
						const nameA = a.getName().toLowerCase(),
							nameB = b.getName().toLowerCase();
						return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
					})
			}));
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
	const segmentOptions = $derived([
		{ value: 'extern', label: `${Binary.intToHexString(memoryBases.extern)} (.extern)` },
		{ value: 'data', label: `${Binary.intToHexString(memoryBases.data)} (.data)` },
		{ value: 'heap', label: `${Binary.intToHexString(memoryBases.heap)} (heap)` },
		{ value: 'gp', label: 'current $gp' },
		{ value: 'sp', label: 'current $sp' },
		{ value: 'text', label: `${Binary.intToHexString(memoryBases.text)} (.text)` },
		{ value: 'kernel', label: `${Binary.intToHexString(memoryBases.kernel)} (.kdata)` },
		{ value: 'mmio', label: `${Binary.intToHexString(memoryBases.mmio)} (MMIO)` }
	]);
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
		return formatInteger(address, hexAddresses, true);
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
		return ascii ? Binary.intToAscii(value) : formatInteger(value, hexValues);
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
	const dataHeightRestorable = $derived(
		dataHeight !== null && displayedDataHeight < naturalDataHeight
	);
	function restoreDataHeight() {
		dataHeight = null;
		onresizecommit();
	}
	function setDataHeight(height: number) {
		// Restoring the full table returns to natural sizing, which follows later content changes.
		dataHeight = height >= naturalDataHeight ? null : Math.round(height);
	}
	// Native selects fire no change when an option is reselected. Opening the list selects a
	// hidden placeholder bearing the current label, so choosing the current range resets it.
	function armSegment() {
		if (segmentSelect && !running) segmentSelect.selectedIndex = 0;
	}
	function restoreSegment() {
		if (segmentSelect?.selectedIndex === 0) segmentSelect.value = segment;
	}
	function segmentKey(event: KeyboardEvent) {
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			if (event.altKey) armSegment();
			else restoreSegment();
		} else if (event.key === 'Enter' || event.key === ' ' || event.key === 'F4') armSegment();
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
		const viewport = node.closest<HTMLElement>('.text-scroll');
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
	bind:clientHeight={executeHeight}
	style:--pane-border-color="var(--theme-border, #a2aab1)"
	style:--table-font={preset.fontFamily}
	style:--table-font-size={preset.fontSize}
	style:--pc-background={`var(--theme-pc, ${preset.text.background})`}
	style:--pc-foreground={`var(--theme-text, ${preset.text.foreground})`}
	style:--changed-background={`var(--theme-data-changed, ${preset.data.background})`}
	style:--delay-background={`var(--theme-delay, ${preset.delaySlot.background})`}
	style:--delay-foreground={`var(--theme-text, ${preset.delaySlot.foreground})`}
	style:--even-background={`var(--theme-row-even, ${preset.evenRow.background})`}
	style:--even-foreground={`var(--theme-text, ${preset.evenRow.foreground})`}
	style:--odd-background={`var(--theme-canvas, ${preset.oddRow.background})`}
	style:--odd-foreground={`var(--theme-text, ${preset.oddRow.foreground})`}
>
	<div class="text-row">
		<Pane
			class="segment text-segment"
			label="Text Segment"
			flex="1"
			height="auto"
			minHeight="0"
			overflow="hidden"
		>
			<h2 class="shrink-0">Text Segment</h2>
			<div class="text-scroll">
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
										onkeydown={commitOnEnter}
									/></td
								><td>{row.basic}</td>
								<td
									>{#if row.modified}<span> ------ </span>{:else}<Button
											tooltip={row.filename}
											class="source-link text-left whitespace-pre"
											onclick={() => onsource(row.filename, row.line)}
											>{row.line}: {row.source}</Button
										>{/if}</td
								>
							</tr>{/each}
					</tbody>
				</table>
			</div>
		</Pane>
		{#if showLabels}<Pane
				class="labels segment"
				label="Labels"
				layout="block"
				flex="0 0 25%"
				height="auto"
				minHeight="0"
				overflow="auto"
			>
				<h2>Labels</h2>
				<div class="label-controls">
					<Tooltip text="Show labels defined in the data segment">
						{#snippet children(trigger, description)}
							<SelectorToggle
								attachment={trigger}
								aria-describedby={description}
								bind:checked={showDataLabels}
								label="Data"
							/>
						{/snippet}
					</Tooltip>
					<Tooltip text="Show labels defined in the text segment">
						{#snippet children(trigger, description)}
							<SelectorToggle
								attachment={trigger}
								aria-describedby={description}
								bind:checked={showTextLabels}
								label="Text"
							/>
						{/snippet}
					</Tooltip>
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
									<Button
										class="w-full text-left"
										tooltip={`Sort by ${heading}`}
										aria-label={`Sort by ${heading}`}
										onclick={() => (labelSortState = sortTransitions[labelSortState][column])}
									>
										{heading}{#if sortColumn === column}<span aria-hidden="true"
												>{sortDescending ? ' ▼' : ' ▲'}</span
											>{/if}
									</Button>
								</th>
							{/each}</tr
						></thead
					>
					{#each labelGroups as group (group.owner)}
						<tbody aria-label={group.file}>
							<tr><th class="label-group" scope="rowgroup" colspan="2">{group.name}</th></tr>
							{#each group.symbols as symbol (symbol.getName())}
								<tr>
									<td>
										<Button tooltip={group.file} onclick={() => navigateLabel(symbol.getAddress())}
											>{symbol.getName()}</Button
										>
									</td>
									<td>{formatAddress(symbol.getAddress())}</td>
								</tr>
							{/each}
						</tbody>
					{/each}
				</table>
			</Pane>{/if}
	</div>
	<PaneDivider
		label="Data Segment height"
		controls={`${id}-data`}
		orientation="horizontal"
		min={minDataHeight}
		max={maxDataHeight}
		value={displayedDataHeight}
		reverse
		onchange={setDataHeight}
		oncommit={onresizecommit}
	/>
	<div
		class="data-area"
		id={`${id}-data`}
		bind:offsetHeight={dataPaneHeight}
		style:height={dataHeight === null ? undefined : `${displayedDataHeight}px`}
	>
		<Pane
			class="segment data-segment"
			label="Data Segment"
			flex="1 1 auto"
			height="auto"
			minHeight="0"
			overflow="hidden"
		>
			<h2 class="data-heading shrink-0">
				Data Segment<Button
					class="grid size-4.5 shrink-0 place-items-center"
					tooltip="Restore full Data Segment height"
					aria-label="Restore full Data Segment height"
					disabled={!dataHeightRestorable}
					onclick={restoreDataHeight}><ToolbarIcon name="expandDataSegment" /></Button
				>
			</h2>
			<div class="data-scroll" bind:clientHeight={dataScrollHeight}>
				<table bind:offsetHeight={dataTableHeight}>
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
											onkeydown={commitOnEnter}
										/></td
									>{/each}</tr
							>{/each}</tbody
					>
				</table>
			</div>
			<div class="data-controls">
				<Button
					class="grid size-5.5 shrink-0 place-items-center"
					tooltip="Previous memory page"
					aria-label="Previous memory page"
					onclick={() => (pageOffset -= memoryPageBytes)}
					><ToolbarIcon name="previousMemoryPage" /></Button
				><select
					aria-label="Data segment base"
					bind:this={segmentSelect}
					bind:value={segment}
					onpointerdown={armSegment}
					onkeydown={segmentKey}
					onblur={restoreSegment}
					onchange={() => {
						pageOffset = 0;
					}}
					><option value="" hidden disabled
						>{segmentOptions.find((option) => option.value === segment)?.label}</option
					>{#each segmentOptions as option (option.value)}<option value={option.value}
							>{option.label}</option
						>{/each}</select
				><Button
					class="grid size-5.5 shrink-0 place-items-center"
					tooltip="Next memory page"
					aria-label="Next memory page"
					onclick={() => (pageOffset += memoryPageBytes)}
					><ToolbarIcon name="nextMemoryPage" /></Button
				>
				<div class="control-separator" role="separator" aria-orientation="vertical"></div>
				<div class="display-options">
					<SelectorToggle bind:checked={hexAddresses} label="Hexadecimal Addresses" />
					<SelectorToggle bind:checked={hexValues} label="Hexadecimal Values" />
					<SelectorToggle bind:checked={ascii} label="ASCII" />
				</div>
			</div>
			{#if memoryError}<p role="alert">{memoryError}</p>{/if}
		</Pane>
	</div>
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
	h2 {
		background: var(--theme-heading, #dde4eb);
		border-bottom: 1px solid var(--theme-border, #a2aab1);
		padding: 3px 6px;
		font-weight: 600;
	}
	.data-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}
	.data-heading :global(svg) {
		width: 16px;
		height: 16px;
	}
	.text-scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}
	.label-controls {
		display: flex;
		gap: 12px;
		padding: 3px 6px;
		background: var(--theme-chrome, #eee);
	}
	.label-group {
		position: static;
		background: var(--theme-heading, #dde4eb);
		color: var(--theme-text, #17202b);
		font-weight: 600;
		text-align: center;
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
		background: var(--theme-chrome, #e5e5e5);
		font-weight: 400;
	}
	th,
	td {
		border: 1px solid var(--theme-border, #bbb);
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
	.data-area {
		display: flex;
		flex: 0 0 auto;
		flex-direction: column;
		min-height: 0;
	}
	.data-scroll {
		flex: 1 1 auto;
		min-height: 0;
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
		outline: 1px solid var(--theme-focus, #467ca8);
		background: var(--theme-canvas, white);
	}
	td.changed {
		background: var(--changed-background);
	}
	.data-controls {
		display: flex;
		gap: 10px;
		align-items: center;
		overflow-x: auto;
		background: var(--theme-chrome, #eee);
		flex-shrink: 0;
		padding: 2px 5px;
	}
	.data-controls > select {
		flex-shrink: 0;
	}
	.data-controls select {
		background: var(--theme-chrome, #eee);
		color: var(--theme-text, #17202b);
	}
	.data-controls option {
		background: var(--theme-canvas, white);
		color: var(--theme-text, #17202b);
	}
	.control-separator {
		flex: 0 0 1px;
		align-self: stretch;
		margin: 2px 0;
		background: var(--theme-divider, #b3b3b3);
	}
	.display-options {
		display: flex;
		flex-shrink: 0;
		white-space: nowrap;
		gap: 15px;
	}
	p {
		flex-shrink: 0;
		color: var(--theme-error, #a11);
		padding: 4px;
	}
</style>
