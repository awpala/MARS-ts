# Online Help references

This directory owns the GitHub-readable companions to the application's Help content. Each page covers the same article as its in-app counterpart, including current browser workflows, historical notices, examples, reference links, and attribution. The Help browser and standalone Help-menu dialogs offer Read Online links directly to these files on the `main` branch of `awpala/MARS-ts`. GitHub renders them independently of the running application, so readers can close the modal and keep a reference tab beside the IDE. Online pages reflect the published branch; unpublished local changes appear online only after they are published there.

The HTML fragments and these Markdown files are hand-maintained duplicates. Neither format generates the other, and the application does not load Markdown at runtime. The [article catalog](../articles.ts) maps each Help view to its companion filename. The immediate Overview and About views live in [HelpArticle.svelte](../HelpArticle.svelte); the other pairs share a basename.

| Article            | Markdown reference                                        | In-app source                                       |
| ------------------ | --------------------------------------------------------- | --------------------------------------------------- |
| Overview           | [Overview](Overview.md)                                   | [HelpArticle.svelte](../HelpArticle.svelte)         |
| About MARS         | [About MARS](About.md)                                    | [HelpArticle.svelte](../HelpArticle.svelte)         |
| Introduction       | [Introduction](MarsHelpIntro.md)                          | [MarsHelpIntro.html](../MarsHelpIntro.html)         |
| Debugging          | [Interactive Debugging](MarsHelpDebugging.md)             | [MarsHelpDebugging.html](../MarsHelpDebugging.html) |
| Settings           | [Configuration Settings](MarsHelpSettings.md)             | [MarsHelpSettings.html](../MarsHelpSettings.html)   |
| Syscalls           | [Syscalls](SyscallHelp.md)                                | [SyscallHelp.html](../SyscallHelp.html)             |
| Exception Handlers | [Exception Handlers](ExceptionsHelp.md)                   | [ExceptionsHelp.html](../ExceptionsHelp.html)       |
| Macros             | [Macros](MacrosHelp.md)                                   | [MacrosHelp.html](../MacrosHelp.html)               |
| Tools              | [Tools — Legacy Reference](MarsHelpTools.md)              | [MarsHelpTools.html](../MarsHelpTools.html)         |
| Limitations        | [Requirements and Limitations](MarsHelpLimits.md)         | [MarsHelpLimits.html](../MarsHelpLimits.html)       |
| Release History    | [Release History](MarsHelpHistory.md)                     | [MarsHelpHistory.html](../MarsHelpHistory.html)     |
| Bugs/Comments      | [Bug Reporting and General Comments](BugReportingHelp.md) | [BugReportingHelp.html](../BugReportingHelp.html)   |
| Acknowledgements   | [Acknowledgements](Acknowledgements.md)                   | [Acknowledgements.html](../Acknowledgements.html)   |

## Maintaining equivalent content

Update each pair together when an implemented workflow or its documentation changes. Preserve availability notes, defaults, register contracts, status values, examples, historical dates, credits, and external destinations. Use headings and lists for prose, fenced `mips` blocks for the displayed assembly examples, and native Markdown tables for tabular data. Multi-part table cells may use `<br>` to keep distinct arguments or status values readable. HTML layout tables become sections and smaller data tables: the MIDI parameter notes use headings, a pitch/note table, and a patch-range/instrument-family table. Equivalent content need not reproduce HTML layout.

Keep code text unchanged between each displayed HTML example and its Markdown fence. Use relative links for repository resources and retain the [MIT license](../../../../MARSlicense.txt) and original MARS attribution. New or renamed articles require both formats, a catalog `markdownFile` entry, and an index update here. The [catalog tests](../articles.test.ts) verify companion coverage, attribution, code examples, and syscall service-table cells; [browser tests](../../../../tests/browser/help.spec.ts) exercise per-article destinations and separate-tab navigation. Prose and table equivalence require review.

## Attribution

Adapted articles derive from the original MARS help, copyright 2003–2013 Pete Sanderson and Kenneth Vollmar, under the [MIT license](../../../../MARSlicense.txt). Each derived article retains its source notice and visible attribution. The [Help module guide](../README.md) describes the legacy sources and browser adaptations; the legacy files remain unchanged.
