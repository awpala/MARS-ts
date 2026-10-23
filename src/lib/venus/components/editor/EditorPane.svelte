<script lang="ts">
  import SourceEditor from './SourceEditor.svelte';
  import SourceTabs from './SourceTabs.svelte';
</script>

<!-- @component The Edit view: open-document tabs above the highlighted source editor. Composes the two editor views, which read the source workspace from the desktop context; the workspace owns the buffers, selection, scroll position, and persistence. Renders no wrapper element, so both views remain direct children of the pane that hosts it. -->
<SourceTabs />
<SourceEditor />
