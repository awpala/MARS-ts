import { describe, expect, it } from 'vitest';
import { helpArticleOnlineUrl, helpArticles, helpTabs } from './articles.js';

const companions = import.meta.glob<string>('./markdown/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
});

describe('Online Help companions', () => {
  it('gives every article a unique, existing Markdown destination on GitHub', () => {
    expect(new Set(helpArticles.map((article) => article.markdownFile)).size).toBe(
      helpArticles.length
    );
    for (const article of helpArticles) {
      const markdown = companions[`./markdown/${article.markdownFile}`];
      expect(markdown, article.id).toContain(`# ${article.title}\n`);
      expect(helpArticleOnlineUrl(article)).toBe(
        `https://github.com/awpala/MARS-ts/blob/main/src/lib/help/markdown/${article.markdownFile}`
      );
    }
  });

  it('retains every HTML code example verbatim in its Markdown companion', async () => {
    for (const article of helpArticles) {
      const html = (await article.loadHtml?.())?.default ?? '';
      const markdown = companions[`./markdown/${article.markdownFile}`];
      for (const [, source] of html.matchAll(/<pre>([\s\S]*?)<\/pre>/g)) {
        // HTML discards the first line feed immediately after a pre start tag.
        const displayed = source.replace(/^\n/, '');
        expect(markdown, article.id).toContain(`\`\`\`mips\n${displayed}\`\`\``);
      }
      if (article.loadHtml) {
        expect(markdown, article.id).toContain(
          'Copyright © 2003–2013 Pete Sanderson and Kenneth Vollmar'
        );
        expect(markdown, article.id).toContain('[MIT license](../../../../MARSlicense.txt)');
      }
    }
  });

  it('preserves every syscall service-table cell in the Markdown table', async () => {
    const article = helpArticles.find((article) => article.id === 'help-syscalls')!;
    const html = (await article.loadHtml!()).default;
    const markdown = companions[`./markdown/${article.markdownFile}`];
    const visibleText = (value: string) =>
      value
        .replace(/<br\s*\/?>/g, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replaceAll('\\[', '[')
        .replaceAll('\\]', ']')
        .replace(/[*_`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const htmlTable = html.slice(html.indexOf('<table>'), html.indexOf('</table>'));
    const htmlRows = [...htmlTable.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
      [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map(([, cell]) => visibleText(cell))
    );
    const markdownTable = markdown.split('\n\n').find((block) => block.startsWith('| Service'))!;
    const markdownRows = markdownTable
      .split('\n')
      .filter((_, index) => index !== 1)
      .map((row) => row.slice(1, -1).split('|').map(visibleText));
    expect(markdownRows).toEqual(htmlRows);
  });
});

describe('Help browser tabs', () => {
  it('open on the overview and follow the legacy MIPS, MARS, Bugs/Comments, and Acknowledgements order', () => {
    expect(
      helpTabs.map((tab) => [tab.label, tab.articles.map((article) => article.label)])
    ).toEqual([
      ['Overview', ['Help']],
      ['MIPS', ['Syscalls', 'Exception Handlers', 'Macros']],
      [
        'MARS',
        ['Introduction', 'Debugging', 'Settings', 'Tools', 'Limitations', 'Release History']
      ],
      ['Bugs/Comments', ['Bugs/Comments']],
      ['Acknowledgements', ['Acknowledgements']]
    ]);
  });

  it('contain every Help-menu article except About exactly once', () => {
    const tabbed = helpTabs.flatMap((tab) => tab.articles);
    expect(new Set(tabbed).size).toBe(tabbed.length);
    expect(tabbed.toSorted((a, b) => a.id.localeCompare(b.id))).toEqual(
      helpArticles
        .filter((article) => article.id !== 'about')
        .toSorted((a, b) => a.id.localeCompare(b.id))
    );
  });
});
