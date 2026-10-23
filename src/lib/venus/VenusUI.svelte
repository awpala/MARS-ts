<script lang="ts">
  /**
   * Ports the layout/action responsibilities of mars/venus/VenusUI.java, MainPane.java,
   * MessagesPane.java, ExecutePane.java, and RunSpeedPanel.java.
   * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
   */
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { MAIN_VIEWS } from '#lib/browser/DesktopSession.js';
  import { MIN_REGISTER_WIDTH } from '#lib/browser/PaneLayout.js';
  import { DesktopState } from './state/DesktopState.svelte.js';
  import { provideDesktop } from './context/desktop.js';
  import { useDesktopKeyboard } from './hooks/useDesktopKeyboard.js';
  import { EDITOR_MIN_HEIGHT } from './utils/geometry/layout.js';
  import { sourceLabel } from './utils/sources/sourceLabel.js';
  import MenuBar from './components/shell/MenuBar.svelte';
  import Toolbar from './components/shell/Toolbar.svelte';
  import Footer from './components/shell/Footer.svelte';
  import EditorPane from './components/editor/EditorPane.svelte';
  import MessagesPane from './components/debugger/MessagesPane.svelte';
  import TabbedPane from './components/layout/TabbedPane.svelte';
  import PaneDivider from './components/layout/PaneDivider.svelte';
  import LoadingSpinner from './components/feedback/LoadingSpinner.svelte';
  import BackupError from './components/feedback/BackupError.svelte';
  import ExecutePane from './components/debugger/ExecutePane.svelte';
  import RegisterBanksPane from './components/debugger/RegisterBanksPane.svelte';
  import DesktopDialogs from './components/dialogs/DesktopDialogs.svelte';
  import FileImporter from './components/transfers/FileImporter.svelte';
  import FileExporter from './components/transfers/FileExporter.svelte';
  let menuBar: MenuBar | undefined;
  let activeElement = $state<Element | null>(null);
  const desktop = provideDesktop(new DesktopState((restoreFocus) => menuBar?.close(restoreFocus)));
  const { workspace, simulation, display } = desktop;
  const position = $derived(
    display.view === 'Edit' && workspace.current && activeElement === workspace.sourceInput
      ? workspace.position
      : null
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
    <BackupError
      message={workspace.backupError || workspace.autoSaveError || desktop.persistence.error}
    />
    <MenuBar
      bind:this={menuBar}
      bind:showRegisters={display.showRegisters}
      bind:clearAllOutputsOnGo={display.clearAllOutputsOnGo}
    />
    <Toolbar
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
          tabs={MAIN_VIEWS}
          bind:selected={display.view}
          --pane-height="var(--editor-height, 75%)"
          --pane-flex="0 0 auto"
          --pane-min-height={`${EDITOR_MIN_HEIGHT}px`}
          --pane-overflow="auto"
        >
          {#if display.view === 'Edit'}
            <EditorPane />
          {:else}
            {#if simulation.machine && simulation.execution}<ExecutePane
                machine={simulation.machine}
                controller={simulation.controller!}
                snapshot={simulation.execution}
              />{/if}
          {/if}
        </TabbedPane>
        <PaneDivider
          class="editor-divider"
          label="Editor area height"
          controls={`${paneId}-editor`}
          orientation="horizontal"
          min={EDITOR_MIN_HEIGHT}
          max={display.maxEditorHeight}
          value={display.displayedEditorHeight}
          onchange={display.setEditorHeight}
          oncommit={display.persistLayout}
        />
        <MessagesPane />
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
            min={MIN_REGISTER_WIDTH}
            max={display.maxRegisterWidth}
            value={display.displayedRegisterWidth}
            reverse
            onchange={display.setRegisterWidth}
            oncommit={display.persistLayout}
          />
          {#if simulation.machine}<RegisterBanksPane
              id={`${paneId}-registers`}
              registers={simulation.machine.registerFile}
              coprocessor0={simulation.machine.coprocessor0}
              coprocessor1={simulation.machine.coprocessor1}
              machineRevision={simulation.execution?.revision ?? 0}
              controller={simulation.controller!}
            />{/if}
        </div>
      {/if}
    </main>
    <Footer {...desktop.footer} {position} />
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
