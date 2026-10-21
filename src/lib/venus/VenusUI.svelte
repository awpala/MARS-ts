<script lang="ts">
  /**
   * Ports the layout/action responsibilities of mars/venus/VenusUI.java, MainPane.java,
   * MessagesPane.java, ExecutePane.java, and RunSpeedPanel.java.
   * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
   */
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { DesktopState } from './state/DesktopState.svelte.js';
  import { provideDesktop } from './context/desktop.js';
  import { useDesktopKeyboard } from './hooks/useDesktopKeyboard.js';
  import { sourceLabel } from './utils/sourceLabel.js';
  import MenuBar from './components/shell/MenuBar.svelte';
  import Toolbar from './components/shell/Toolbar.svelte';
  import Footer from './components/shell/Footer.svelte';
  import SourceTabs from './components/editor/SourceTabs.svelte';
  import SourceEditor from './components/editor/SourceEditor.svelte';
  import MessagesPane from './components/debugger/MessagesPane.svelte';
  import TabbedPane from './components/layout/TabbedPane.svelte';
  import PaneDivider from './components/layout/PaneDivider.svelte';
  import LoadingSpinner from './components/feedback/LoadingSpinner.svelte';
  import ExecutePane from './components/debugger/ExecutePane.svelte';
  import RegisterBanksPane from './components/debugger/RegisterBanksPane.svelte';
  import DesktopDialogs from './components/dialogs/DesktopDialogs.svelte';
  import FileImporter from './components/transfers/FileImporter.svelte';
  import FileExporter from './components/transfers/FileExporter.svelte';
  let menuBar: MenuBar | undefined;
  let activeElement = $state<Element | null>(null);
  const desktop = provideDesktop(new DesktopState((restoreFocus) => menuBar?.close(restoreFocus)));
  const { workspace, simulation, display } = desktop;
  const loadedFilename = $derived(
    simulation.execution?.programs
      .find(
        (program) => program === simulation.machine?.program && program.getMachineList() !== null
      )
      ?.getFilename()
  );
  const paneId = $props.id();
  const exportVariants = ['single', 'all'] as const;
  useDesktopKeyboard(() => menuBar?.close());
  onMount(desktop.mount);
</script>

<!-- @component Composes the Venus desktop and owns its context lifetime. Domain state, workflows, and browser resources belong to the per-desktop controllers. -->
<svelte:document bind:activeElement />

<svelte:head>
  <title>
    {workspace.current
      ? `${sourceLabel(workspace.current.name, workspace.editor.isDirty(workspace.current))} - `
      : ''}MARS
  </title>
</svelte:head>
<pre class="print-source">{workspace.current?.text ?? ''}</pre>

{#if !desktop.visible}
  <div class="loading-screen">
    <LoadingSpinner label="Loading MARS…" />
  </div>
{/if}
<fieldset
  disabled={!desktop.visible}
  class={['application-controls', { initializing: !desktop.visible }]}
  aria-busy={!desktop.visible}
>
  <FileImporter />
  {#each exportVariants as variant (variant)}<FileExporter {variant} />{/each}
  <div class="desktop flex h-dvh min-h-120 flex-col overflow-hidden text-[12px]">
    {#if workspace.backupError || workspace.autoSaveError || desktop.persistence.error}<p
        class="backup-error"
        role="alert"
      >
        {workspace.backupError || workspace.autoSaveError || desktop.persistence.error}
      </p>{/if}
    <MenuBar
      bind:this={menuBar}
      bind:showRegisters={display.showRegisters}
      displayToggles={desktop.displayToggles}
      engineSettings={simulation.engineSettings}
      running={simulation.running}
      onsetting={simulation.updateEngineSetting}
    />
    <Toolbar
      displayToggles={desktop.displayToggles}
      bind:showLines={display.showLines}
      bind:speed={display.speed}
      showSpeed={display.view === 'Execute'}
    />
    <main
      class="workspace"
      bind:clientWidth={display.workspaceWidth}
      style:--register-width={`${display.displayedRegisterWidth}px`}
    >
      <div
        class="left-panes"
        bind:clientHeight={display.leftPaneHeight}
        style:--editor-height={`${display.displayedEditorHeight}px`}
      >
        <TabbedPane
          id={`${paneId}-editor`}
          class="main-pane"
          label="Source and execution"
          tabs={['Edit', 'Execute']}
          bind:selected={display.view}
          --pane-height="var(--editor-height, 75%)"
          --pane-flex="0 0 auto"
          --pane-min-height="150px"
          --pane-overflow="auto"
        >
          {#if display.view === 'Edit'}
            <SourceTabs
              tabs={workspace.tabs.map((tab) => ({
                id: tab.id,
                name: tab.name,
                dirty: workspace.editor.isDirty(tab)
              }))}
              selected={workspace.current?.id}
              onselect={workspace.select}
              onclose={(id) => workspace.startClose([id])}
              canRename={!simulation.running && !desktop.hasModal}
              canReorder={!simulation.running && !desktop.hasModal}
              onreorder={workspace.reorder}
              onrename={workspace.rename}
            />
            <SourceEditor
              current={workspace.current}
              running={simulation.running}
              showLines={display.showLines}
              helpEnabled={!desktop.hasModal}
              instructionSet={simulation.machine?.instructionSet}
              bind:sourceInput={workspace.sourceInput}
              bind:scrollTop={workspace.sourceScrollTop}
              bind:scrollLeft={workspace.sourceScrollLeft}
              onedit={workspace.edit}
              onselection={(start, end) => {
                workspace.selectionStart = start;
                workspace.selectionEnd = end;
              }}
            />
          {:else}
            {#if simulation.machine && simulation.execution}<ExecutePane
                machine={simulation.machine}
                controller={simulation.controller!}
                snapshot={simulation.execution}
                bind:selectedLabel={simulation.labelSelection}
                breakpoints={simulation.breakpoints}
                ontogglebreakpoint={simulation.toggleBreakpoint}
                onedit={() => simulation.controller?.refresh()}
                onsource={workspace.showSource}
                bind:showLabels={display.showLabels}
                bind:showDataLabels={display.showDataLabels}
                bind:showTextLabels={display.showTextLabels}
                bind:labelSortState={display.labelSortState}
                bind:ascii={display.ascii}
                bind:hexAddresses={display.hexAddresses}
                bind:hexValues={display.hexValues}
                bind:dataHeight={display.dataSegmentHeight}
                bind:segment={display.dataSegment}
                bind:pageOffset={display.dataPageOffset}
                onresizecommit={display.persistLayout}
              />{/if}
          {/if}
        </TabbedPane>
        <PaneDivider
          class="editor-divider"
          label="Editor area height"
          controls={`${paneId}-editor`}
          orientation="horizontal"
          min={150}
          max={display.maxEditorHeight}
          value={display.displayedEditorHeight}
          onchange={display.setEditorHeight}
          oncommit={display.persistLayout}
        />
        <MessagesPane
          bind:messageTab={simulation.messageTab}
          messages={simulation.messages}
          runIO={simulation.runIO}
          awaitingInput={!!simulation.inputRequest && simulation.inputRequest.prompt === null}
          inputText={simulation.inputText}
          oninput={simulation.consoleInputChanged}
          onclear={simulation.clearOutput}
          onsubmit={() => simulation.completeInput(true)}
          onstop={() => simulation.controller?.stop()}
        />
      </div>
      {#if display.showRegisters}
        <div
          class="register-sidebar"
          transition:slide={{ axis: 'x', duration: desktop.visible ? 220 : 0 }}
        >
          <PaneDivider
            class="register-divider"
            label="Register panel width"
            controls={`${paneId}-registers`}
            orientation="vertical"
            min={260}
            max={display.maxRegisterWidth}
            value={display.displayedRegisterWidth}
            reverse
            onchange={(width) => (display.registerWidth = Math.round(width))}
            oncommit={display.persistLayout}
          />
          {#if simulation.machine}<RegisterBanksPane
              hexValues={display.hexValues}
              id={`${paneId}-registers`}
              bind:selected={display.registerTab}
              registers={simulation.machine.registerFile}
              coprocessor0={simulation.machine.coprocessor0}
              coprocessor1={simulation.machine.coprocessor1}
              machineRevision={simulation.execution?.revision ?? 0}
              controller={simulation.controller!}
              running={simulation.running}
              onedit={() => simulation.controller?.refresh()}
            />{/if}
        </div>
      {/if}
    </main>
    <Footer
      filenamePrefix={display.view === 'Execute'
        ? loadedFilename
          ? 'Loaded: '
          : ''
        : workspace.current
          ? 'Editing: '
          : ''}
      filename={display.view === 'Execute'
        ? (loadedFilename ?? 'No program loaded')
        : (workspace.current?.name ?? 'No current edits')}
      position={display.view === 'Edit' &&
      workspace.current &&
      activeElement === workspace.sourceInput
        ? workspace.position
        : null}
      status={display.view === 'Execute' || simulation.execution?.status === 'error'
        ? (simulation.execution?.status ?? 'idle')
        : null}
      breakpointsEnabled={simulation.breakpointsEnabled}
    />
  </div>
</fieldset>

<DesktopDialogs />

<style>
  .desktop {
    background: var(--theme-background, #ededed);
    color: var(--theme-text, #17202b);
  }
  .initializing {
    visibility: hidden;
  }
  .loading-screen {
    position: fixed;
    inset: 0;
    display: grid;
    place-content: center;
    background: var(--theme-background, #ededed);
    color: var(--theme-text, #17202b);
    font-size: 14px;
  }
  .backup-error {
    padding: 6px 10px;
    color: var(--theme-error, #8b1a1a);
    background: var(--theme-warning, #fff1db);
  }
  .application-controls {
    display: contents;
  }
  .workspace {
    display: flex;
    flex: 1;
    min-height: 0;
    padding: 4px;
    gap: 0;
  }
  .register-sidebar {
    display: flex;
    flex: 0 0 auto;
    min-height: 0;
    padding-left: 5px;
    gap: 5px;
    overflow: hidden;
  }
  .left-panes {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 300px;
    min-height: 0;
  }
  p {
    margin: 8px 0;
  }

  .print-source {
    display: none;
  }
  @media print {
    .print-source {
      display: block;
      white-space: pre-wrap;
      font: 12px monospace;
    }
    .desktop {
      display: none;
    }
  }
</style>
