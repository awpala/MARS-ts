<script lang="ts">
  import Button from '../controls/Button.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import Modal from './Modal.svelte';
  import DialogActions from './DialogActions.svelte';
  import HelpArticle from '#lib/help/HelpArticle.svelte';
  import HelpBrowser from '#lib/help/HelpBrowser.svelte';
  import { helpBrowserArticle } from '#lib/help/articles.js';
  const desktop = getDesktop();
  const { simulation } = desktop;
  const onopen = (source: string) => void desktop.openHelpSource(source);
</script>

<!-- @component Selected Help content and source-transfer controls; desktop context owns article selection and the retained browser tabs. The Help command opens the tabbed browser, while individual Help-menu entries open one article. A browser recovered from the session appears only once the desktop is revealed. -->
{#if desktop.helpBrowserOpen}
  {#if desktop.visible}
    <Modal
      title={helpBrowserArticle.title}
      onclose={desktop.closeHelp}
      initialFocus=".help-article"
      --modal-width="min(900px, 94vw)"
      --modal-body-display="grid"
      --modal-body-overflow="hidden"
    >
      <HelpBrowser
        bind:tab={desktop.helpTab}
        bind:articleIds={desktop.helpTabArticles}
        canOpen={!simulation.running}
        {onopen}
      />
      <DialogActions><Button onclick={desktop.closeHelp}>Close</Button></DialogActions>
    </Modal>
  {/if}
{:else if desktop.help}
  <Modal
    title={desktop.help.title}
    onclose={desktop.closeHelp}
    initialFocus=".help-article"
    --modal-width={desktop.help.loadHtml ? 'min(900px, 94vw)' : 'min(560px, 90vw)'}
  >
    <HelpArticle article={desktop.help} canOpen={!simulation.running} {onopen} />
    <DialogActions><Button onclick={desktop.closeHelp}>Close</Button></DialogActions>
  </Modal>
{/if}
