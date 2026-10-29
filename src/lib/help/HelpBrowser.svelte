<script lang="ts">
  /**
   * Presents the tabbed Help window of mars/venus/HelpHelpAction.java over the bundled articles.
   * Copyright 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
   */
  import PaneTabs from '#lib/venus/components/controls/PaneTabs.svelte';
  import type { Snippet } from 'svelte';
  import HelpArticle from './HelpArticle.svelte';
  import { helpTabs, type HelpArticle as Article } from './articles.js';

  /** Presentation contract; the desktop owns dialog state, dismissal, and the retained tab selection. */
  type Props = {
    /** Parent-owned selected top-level tab ID, bindable; an unknown ID shows the overview. */
    tab: string;
    /** Parent-owned nested article ID per top-level tab, bindable; a missing entry selects the tab's first article. */
    articleIds: Record<string, string>;
    /** Required desktop callback; creates an editor source from the exact displayed code text. */
    onopen: (source: string) => void;
    /** Required desktop permission; false while execution prevents creating an editor source. */
    canOpen: boolean;
    /** Required caller-owned action row, rendered below scrolling content with the selected article. */
    actions: Snippet<[Article]>;
  };
  let {
    tab: tabId = $bindable(),
    articleIds = $bindable(),
    onopen,
    canOpen,
    actions
  }: Props = $props();
  const tab = $derived(helpTabs.find((entry) => entry.id === tabId) ?? helpTabs[0]);
  // Like Swing's nested JTabbedPanes, each tab keeps its own article selection.
  const article = $derived(
    tab.articles.find((entry) => entry.id === articleIds[tab.id]) ?? tab.articles[0]
  );
</script>

<!-- @component Tabbed Help browser over caller-retained selection; nested strips select articles within the MIPS and MARS tabs. Adapted from MARS, copyright 2003–2013 Pete Sanderson and Kenneth Vollmar, MIT. -->
<div class="help-browser">
  <div role="group" aria-label="Help topics">
    <PaneTabs tabs={helpTabs} selected={tab.id} onselect={(selected) => (tabId = selected)} />
  </div>
  {#if tab.articles.length > 1}
    <div role="group" aria-label={`${tab.label} topics`} class="nested">
      <PaneTabs
        tabs={tab.articles}
        selected={article.id}
        onselect={(selected) => (articleIds[tab.id] = selected)}
      />
    </div>
  {/if}
  {#key article.id}
    <!-- The scrolling article region must be keyboard-reachable from the tab strips. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="help-panel" role="region" aria-label={article.title} tabindex="0">
      <HelpArticle {article} {onopen} {canOpen} />
    </div>
  {/key}
</div>
{@render actions(article)}

<style>
  .help-browser {
    display: flex;
    flex-direction: column;
    height: min(560px, calc(90dvh - 130px));
    min-height: 0;
  }
  .nested {
    --tab-padding: 3px 10px;
    --theme-chrome: var(--theme-surface, #f0f0f0);
  }
  .help-panel {
    flex: 1;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 12px 16px;
    border: 1px solid var(--theme-border, #94a3b8);
    border-top: 0;
  }
  .help-panel:focus-visible {
    outline: 2px solid var(--theme-focus, #2c679c);
    outline-offset: -2px;
  }
</style>
