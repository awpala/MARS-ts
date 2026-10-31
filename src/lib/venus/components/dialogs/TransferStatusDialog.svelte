<script lang="ts">
  import LoadingSpinner from '../feedback/LoadingSpinner.svelte';
  import { openModalDialog } from '../../utils/dom/dialogLifecycle.js';
  /** Blocking status for a pending file transfer; the caller owns when it is shown. */
  type Props = {
    /** Required visible status text, such as `Exporting…`, which also names the dialog. */
    status: string;
  };
  let { status }: Props = $props();
</script>

<!-- @component Native modal dialog showing a spinner and status text while a file transfer is pending. It cannot be dismissed: Escape is ignored and the rest of the page is inert until the owner removes it, after which focus returns to the element that had it. -->
<dialog
  {@attach openModalDialog}
  aria-label={status}
  aria-busy="true"
  tabindex="-1"
  oncancel={(event) => event.preventDefault()}
>
  <LoadingSpinner label={status} />
</dialog>

<style>
  dialog {
    margin: auto;
    border: 1px solid var(--theme-border, #6a7786);
    padding: 20px 28px;
    color: var(--theme-text, #17202b);
    background: var(--theme-surface, #f0f0f0);
    box-shadow: 0 8px 32px #0005;
    font-size: 13px;
  }
  dialog:focus {
    outline: none;
  }
  dialog::backdrop {
    background: #0003;
  }
</style>
