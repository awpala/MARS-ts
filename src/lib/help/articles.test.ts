import { describe, expect, it } from 'vitest';
import { helpArticles, helpTabs } from './articles.js';

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
