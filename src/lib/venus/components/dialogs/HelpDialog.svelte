<script lang="ts">
  import Button from '../controls/Button.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import Modal from './Modal.svelte';
  import DialogActions from './DialogActions.svelte';
  import LinkedResource from '../controls/LinkedResource.svelte';
  import HelpArticle from '#lib/help/HelpArticle.svelte';
  import HelpBrowser from '#lib/help/HelpBrowser.svelte';
  import {
    helpBrowserArticle,
    helpArticleOnlineUrl,
    type HelpArticle as Article
  } from '#lib/help/articles.js';
  const desktop = getDesktop();
  const { simulation } = desktop;
  const onopen = (source: string) => void desktop.openHelpSource(source);
</script>

{#snippet actions(article: Article)}
  <DialogActions>
    {#snippet leading()}
      <span class="read-online">
        <LinkedResource
          href={helpArticleOnlineUrl(article)}
          aria-label="Read Online (opens in a new tab)"
          tooltip="Read this article on GitHub (opens in a new tab)">Read Online</LinkedResource
        >
      </span>
    {/snippet}
    <Button onclick={desktop.closeHelp}>Close</Button>
  </DialogActions>
{/snippet}

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
        {actions}
      />
    </Modal>
  {/if}
{:else if desktop.help}
  <Modal
    title={desktop.help.title}
    onclose={desktop.closeHelp}
    initialFocus=".help-article"
    --modal-width={desktop.help.loadHtml ? 'min(900px, 94vw)' : 'min(560px, 90vw)'}
    --modal-body-display="grid"
    --modal-body-overflow="hidden"
  >
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="single-article"
      role="region"
      aria-label={desktop.help.title}
      tabindex="0"
      data-testid="help-article-scroll"
    >
      <HelpArticle article={desktop.help} canOpen={!simulation.running} {onopen} />
    </div>
    {@render actions(desktop.help)}
  </Modal>
{/if}

<style>
  .single-article {
    max-height: min(560px, calc(90dvh - 170px));
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
  }
  .single-article:focus-visible {
    outline: 2px solid var(--theme-focus, #2c679c);
    outline-offset: -2px;
  }
  .read-online :global(a) {
    display: inline-block;
    padding: 4px 13px;
    border: 1px solid var(--theme-border, #929eaa);
    background: var(--theme-surface, #f8f8f8);
  }
  .read-online :global(a:hover) {
    border-color: var(--theme-accent-border, #849eb5);
    background: var(--theme-hover, #dbe8f2);
  }
</style>
