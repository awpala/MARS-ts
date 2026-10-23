<script lang="ts">
  /**
   * Composes the views of mars/venus/TextSegmentWindow.java, DataSegmentWindow.java, and LabelsWindow.java.
   * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
   */
  import type { Globals } from '#lib/engine/Globals.js';
  import { getDesktop } from '../../context/desktop.js';
  import type { RunController } from '../../RunController.js';
  import DataSegmentPane from './DataSegmentPane.svelte';
  import { ExecuteView, setExecuteView } from './ExecuteView.svelte.js';
  import LabelsPane from './LabelsPane.svelte';
  import TextSegmentPane from './TextSegmentPane.svelte';
  /** The mounted machine; the desktop owners supply every persisted preference, selection, and breakpoint. */
  type Props = {
    /** Required initialized machine; all reads use its public, non-notifying interfaces. */
    machine: Globals;
    /** Required session controller identifies synchronous backstep writes without treating assembly or edits as execution. */
    controller: RunController;
    /** Required controller snapshot; revision invalidates views after machine changes. */
    snapshot: ReturnType<RunController['getState']>;
  };
  let { machine, controller, snapshot }: Props = $props();
  const { display, simulation } = getDesktop();
  const id = $props.id();
  let executeHeight = $state(0);
  const view = new ExecuteView(
    {
      id,
      get machine() {
        return machine;
      },
      get controller() {
        return controller;
      },
      get snapshot() {
        return snapshot;
      }
    },
    display,
    simulation
  );
  setExecuteView(view);
  // Reopening Execute or restoring a session reveals the selection after the PC attachment runs.
  $effect(() => view.revealSelection());
</script>

<!-- @component Actual assembled statements, breakpoints, symbol navigation, and editable paged memory for the session. Composes the Text Segment, Labels, and Data Segment panes and shares their navigation, formatting, and write observation through one Execute view context; persisted selection, range, display bases, and sizes live in the desktop's display and simulation owners. -->
<div
  class="execute-pane"
  bind:clientHeight={executeHeight}
  style:--pane-border-color="var(--theme-border, #a2aab1)"
>
  <div class="text-row">
    <TextSegmentPane />
    {#if display.showLabels}<LabelsPane />{/if}
  </div>
  <DataSegmentPane {executeHeight} />
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
</style>
