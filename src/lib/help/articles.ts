/**
 * Help menu catalog adapted from mars/venus/HelpHelpAction.java and help/*.html.
 * Copyright 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 */

/** Immutable menu metadata and loaders for trusted, bundled articles; never accepts user HTML. */
export type HelpArticle = {
  /** Stable desktop command and article identifier. */
  readonly id: string;
  /** Human-readable Help menu entry. */
  readonly label: string;
  /** Accessible dialog title. */
  readonly title: string;
  /** Hand-maintained companion filename under help/markdown/, also used for the GitHub destination. */
  readonly markdownFile: string;
  /** Load the authored HTML module on demand; absent for the immediate overview and About content. */
  readonly loadHtml?: () => Promise<{
    /** Trusted article fragment exported by Vite's raw asset loader. */
    default: string;
  }>;
};

/** All Help menu entries, including the existing F1 overview and About article. */
export const helpArticles: readonly HelpArticle[] = [
  { id: 'help', label: 'Help', title: 'MARS Help', markdownFile: 'Overview.md' },
  { id: 'about', label: 'About MARS', title: 'About MARS', markdownFile: 'About.md' },
  {
    id: 'help-intro',
    label: 'Introduction',
    title: 'Introduction',
    markdownFile: 'MarsHelpIntro.md',
    loadHtml: () => import('./MarsHelpIntro.html?raw')
  },
  {
    id: 'help-debugging',
    label: 'Debugging',
    title: 'Interactive Debugging',
    markdownFile: 'MarsHelpDebugging.md',
    loadHtml: () => import('./MarsHelpDebugging.html?raw')
  },
  {
    id: 'help-settings',
    label: 'Settings',
    title: 'Configuration Settings',
    markdownFile: 'MarsHelpSettings.md',
    loadHtml: () => import('./MarsHelpSettings.html?raw')
  },
  {
    id: 'help-syscalls',
    label: 'Syscalls',
    title: 'Syscalls',
    markdownFile: 'SyscallHelp.md',
    loadHtml: () => import('./SyscallHelp.html?raw')
  },
  {
    id: 'help-exceptions',
    label: 'Exception Handlers',
    title: 'Exception Handlers',
    markdownFile: 'ExceptionsHelp.md',
    loadHtml: () => import('./ExceptionsHelp.html?raw')
  },
  {
    id: 'help-macros',
    label: 'Macros',
    title: 'Macros',
    markdownFile: 'MacrosHelp.md',
    loadHtml: () => import('./MacrosHelp.html?raw')
  },
  {
    id: 'help-tools',
    label: 'Tools',
    title: 'Tools — Legacy Reference',
    markdownFile: 'MarsHelpTools.md',
    loadHtml: () => import('./MarsHelpTools.html?raw')
  },
  {
    id: 'help-limits',
    label: 'Limitations',
    title: 'Requirements and Limitations',
    markdownFile: 'MarsHelpLimits.md',
    loadHtml: () => import('./MarsHelpLimits.html?raw')
  },
  {
    id: 'help-history',
    label: 'Release History',
    title: 'Release History',
    markdownFile: 'MarsHelpHistory.md',
    loadHtml: () => import('./MarsHelpHistory.html?raw')
  },
  {
    id: 'help-bugs',
    label: 'Bugs/Comments',
    title: 'Bug Reporting and General Comments',
    markdownFile: 'BugReportingHelp.md',
    loadHtml: () => import('./BugReportingHelp.html?raw')
  },
  {
    id: 'help-acknowledgements',
    label: 'Acknowledgements',
    title: 'Acknowledgements',
    markdownFile: 'Acknowledgements.md',
    loadHtml: () => import('./Acknowledgements.html?raw')
  }
];

/** Direct GitHub view of an article's Markdown companion on the repository's main branch. */
export function helpArticleOnlineUrl(article: HelpArticle): string {
  return `https://github.com/awpala/MARS-ts/blob/main/src/lib/help/markdown/${article.markdownFile}`;
}

/** One top-level tab of the F1 Help browser; a tab holding several articles shows a nested strip. */
export type HelpTab = {
  /** Stable tab identifier, unique within the browser. */
  readonly id: string;
  /** Visible tab caption. */
  readonly label: string;
  /** Ordered articles; the first is selected when the tab is first shown. */
  readonly articles: readonly HelpArticle[];
};

function articles(...ids: string[]): HelpArticle[] {
  return ids.map((id) => helpArticles.find((article) => article.id === id)!);
}

/** The Help command's catalog entry, which opens the tabbed browser rather than a single article. */
export const helpBrowserArticle: HelpArticle = articles('help')[0];

/**
 * F1 Help browser tabs. The overview opens first; the remaining tabs follow the MIPS, MARS,
 * Bugs/Comments, and Acknowledgements order and nesting of HelpHelpAction.actionPerformed for the
 * articles bundled here.
 */
export const helpTabs: readonly HelpTab[] = [
  { id: 'overview', label: 'Overview', articles: [helpBrowserArticle] },
  {
    id: 'mips',
    label: 'MIPS',
    articles: articles('help-syscalls', 'help-exceptions', 'help-macros')
  },
  {
    id: 'mars',
    label: 'MARS',
    articles: articles(
      'help-intro',
      'help-debugging',
      'help-settings',
      'help-tools',
      'help-limits',
      'help-history'
    )
  },
  { id: 'bugs', label: 'Bugs/Comments', articles: articles('help-bugs') },
  { id: 'acknowledgements', label: 'Acknowledgements', articles: articles('help-acknowledgements') }
];
