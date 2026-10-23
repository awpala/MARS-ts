<script lang="ts">
  /**
   * Presents help/*.html and the help/about responsibilities of mars/venus/HelpHelpAction.java
   * and mars/venus/HelpAboutAction.java.
   * Copyright 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
   */
  import { asset } from '$app/paths';
  import { mount, unmount } from 'svelte';
  import Clipboard from '#lib/venus/components/transfers/Clipboard.svelte';
  import LinkedResource from '#lib/venus/components/controls/LinkedResource.svelte';
  import type { HelpArticle } from './articles.js';

  /** Presentation contract; the desktop owns dialog state and dismissal. */
  type Props = {
    /** Required catalog entry. Only reviewed, bundled HTML may be rendered. */
    article: HelpArticle;
    /** Required desktop callback; creates an editor source from the exact displayed code text. */
    onopen: (source: string) => void;
    /** Required desktop permission; false while execution prevents creating an editor source. */
    canOpen: boolean;
  };
  let { article, onopen, canOpen }: Props = $props();
  const content = $derived(article.loadHtml?.());

  // Preserve valid article HTML; each injected control is a Svelte component with explicit teardown.
  function enhanceExamples(element: HTMLElement) {
    const enabled = canOpen;
    const cleanup: (() => void)[] = [];
    for (const [index, pre] of [...element.querySelectorAll('pre')].entries()) {
      const source = pre.textContent ?? '';
      const controls = document.createElement('div');
      controls.className = 'snippet-controls';
      pre.before(controls);
      const copy = mount(Clipboard, {
        target: controls,
        props: { variant: 'copy-code', source, label: `Copy code example ${index + 1}` }
      });
      const transfer = mount(Clipboard, {
        target: controls,
        props: {
          variant: 'transfer-to-file',
          source,
          label: `Open code example ${index + 1} as new file`,
          disabled: !enabled,
          ontransfer: (source) => onopen(source)
        }
      });
      cleanup.push(() => {
        void unmount(copy);
        void unmount(transfer);
        controls.remove();
      });
    }
    return () => cleanup.forEach((release) => release());
  }
</script>

<!-- @component Help article presentation, including the overview and About; the app-wide Modal owns dialog behavior. Adapted articles credit MARS, copyright 2003–2013 Pete Sanderson and Kenneth Vollmar, MIT. -->
<article class="help-article" tabindex="-1" aria-label={article.title}>
  {#if article.loadHtml}
    {#key article.id}
      {#await content}
        <p role="status">Loading article…</p>
      {:then loaded}
        <div {@attach enhanceExamples}>
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- Only repository-authored HTML modules from the Help catalog; no user-provided content. -->
          {@html loaded?.default ?? ''}
        </div>
      {:catch}
        <p role="alert">Unable to load this article. Reload the page and try again.</p>
      {/await}
    {/key}
    <footer>
      Adapted from
      <LinkedResource href="https://dpetersanderson.github.io/Help/MarsHelpIntro.html"
        >MARS help</LinkedResource
      >. Copyright © 2003–2013 Pete Sanderson and Kenneth Vollmar.
      <LinkedResource href={asset('MARSlicense.txt')}>
        MIT license (opens in a new tab)</LinkedResource
      >.
    </footer>
  {:else if article.id === 'about'}
    <h3>MARS — MIPS Assembler and Runtime Simulator</h3>
    <p>MARS-ts 1.0 development</p>
    <p>
      Original MARS: copyright © 2003–2013 Pete Sanderson and Kenneth Vollmar. Distributed under the
      MIT license.
    </p>
    <p>Mars imagery credit: NASA/JPL.</p>
    <p>
      <LinkedResource href={asset('MARSlicense.txt')}>
        Read the MIT license (opens in a new tab)</LinkedResource
      >
    </p>
  {:else}
    <p>
      New creates a source file; Open selects saved files in this browser. Save commits your source
      locally, and Auto Save commits edits automatically when enabled. Open tabs and in-progress
      text are recovered after reload. Import reads .asm or .s files from your computer; Export
      downloads copies.
    </p>
    <p>
      Registers remain visible beside Edit and Execute. Use the toolbar toggles to change value
      display and label visibility.
    </p>
    <p>
      Assemble (F3) translates the current source. Go (F5), Step (F7), Backstep (F8), Pause (F9),
      Stop (F11), and Reset (F12) control execution. Select breakpoints in Text Segment below
      unlimited speed, even while Go is running. Tools and memory export are deferred.
    </p>
    <p>
      The Help menu also contains Introduction, Debugging, Settings, Syscalls, Exception Handlers,
      Macros, Tools, Limitations, Release History, Bugs/Comments, and Acknowledgements articles.
    </p>
  {/if}
</article>

<style>
  .help-article {
    font-size: 14px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .help-article:focus {
    outline: none;
  }
  .help-article :global(h3),
  .help-article :global(h4) {
    margin: 1em 0 0.5em;
    font-weight: 600;
  }
  .help-article :global(h3) {
    font-size: 1.15em;
  }
  .help-article :global(p),
  .help-article :global(ul),
  .help-article :global(ol),
  .help-article :global(pre) {
    margin: 0.75em 0;
  }
  .help-article :global(ul),
  .help-article :global(ol) {
    padding-left: 1.6em;
  }
  .help-article :global(ul) {
    list-style: disc;
  }
  .help-article :global(ol) {
    list-style: decimal;
  }
  .help-article :global(li + li) {
    margin-top: 0.5em;
  }
  .help-article :global(pre) {
    overflow-x: auto;
    padding: 12px;
    background: var(--theme-background, #e5e7eb);
    tab-size: 4;
  }
  .help-article :global(.snippet-controls) {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 12px;
    padding: 4px 6px;
    border: 1px solid var(--theme-border, #94a3b8);
    background: var(--theme-heading, #d9e4ef);
  }
  .help-article :global(.snippet-controls + pre) {
    margin-top: 0;
  }
  .help-article :global(code),
  .help-article :global(pre) {
    font-family: monospace;
  }
  .help-article :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
  }
  .help-article :global(th),
  .help-article :global(td) {
    border: 1px solid var(--theme-border, #94a3b8);
    padding: 6px;
    text-align: left;
    vertical-align: top;
  }
  .help-article :global(th),
  .help-article :global(.notice) {
    background: var(--theme-heading, #d9e4ef);
  }
  .help-article :global(.service-reference) {
    max-height: min(420px, 55dvh);
    overflow: auto;
    overscroll-behavior: contain;
    border: 1px solid var(--theme-border, #94a3b8);
  }
  .help-article :global(.service-reference:focus-visible) {
    outline: 2px solid var(--theme-focus, #2c679c);
  }
  .help-article :global(.service-reference table) {
    table-layout: fixed;
    min-width: 620px;
    margin: 0;
    border-collapse: separate;
    border-spacing: 0;
  }
  .help-article :global(.service-reference th) {
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .help-article :global(.service-reference tbody tr:nth-child(even)) {
    background: var(--theme-row-even, #eaf0f6);
  }
  .help-article :global(.service-name) {
    width: 20%;
  }
  .help-article :global(.service-code) {
    width: 12%;
  }
  .help-article :global(.service-arguments) {
    width: 26%;
  }
  .help-article :global(.service-result) {
    width: 26%;
  }
  .help-article :global(.service-availability) {
    width: 16%;
  }
  .help-article :global(.notice) {
    padding: 12px;
  }
  .help-article :global(a) {
    color: var(--theme-accent-text, #0645ad);
    text-decoration: underline;
  }
  footer {
    border-top: 1px solid var(--theme-border, #94a3b8);
    margin-top: 24px;
    padding-top: 12px;
    font-size: 12px;
  }
</style>
