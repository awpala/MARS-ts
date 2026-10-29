# Documentation contracts and version policy

Read this guide when writing or reviewing documentation, public API comments, provisioning explanations, or dependency-version claims. Its requirements apply across READMEs, decision records, and the agent harness.

## Port documentation

Application behavior is documented against the current implementation, never against what the port plan intends. Module READMEs and ADRs explain the port independently of the agent harness; never make a module README depend on a file under `docs/agents/`.

**Keep the system guide current.** The root [IMPLEMENTATION.md](../../IMPLEMENTATION.md) explains the implemented architecture, module relationships, browser adaptations, persistence, supported workflows, evidence, and remaining limitations. Update the relevant prose, Mermaid diagrams, and tables in the same change that adds or ports a feature or changes those contracts. Describe modules rather than maintaining an exhaustive source-file inventory. Keep the root README a brief entry point; module READMEs own local contracts, ADRs own consequential decisions, and the implementation guide connects them into the current system. Do not describe planned functionality as available or turn the guide into a session log.

**A directory README describes a stable module boundary.** Lead with its responsibility, ownership, relationships, and extension criteria, even when it currently holds one file. For an engine module, also record **which legacy classes it ports**, the numeric conventions it uses (32-bit `number` versus `bigint`), and any deliberate divergence from MARS with a link to its ADR. Do not maintain exhaustive file, component, or export inventories that duplicate the source tree.

**Preserve explanatory depth.** When updating documentation, retain rationale, supported syntax, examples, comparison tables, lifecycle rules, failure modes, and operating procedures. Do not replace a detailed document with an outline because the current code is small.

**Separate evidence from intent.** The [port plan](../adrs/0000-port-plan.md) and open decisions describe intended work; READMEs describe what exists. Never copy a reference project's test results or guarantees as evidence about this repository, and never describe a parity claim as verified without the fixture that verifies it.

**Provisioning comments are part of the operational documentation.** Keep [setup-env.sh](../../.devcontainer/scripts/setup-env.sh), [devcontainer.json](../../.devcontainer/devcontainer.json), and the helper scripts comprehensively annotated: execution context, step ordering, tool choices, pin alignment, generated artifacts, failure handling, recovery, and which parts are provisional. Update comments when behavior changes; do not strip them as stylistic cleanup.

## Deviation catalog maintenance

[docs/deviations.md](../deviations.md) is the maintained comparison of implemented MARS-ts behavior with final MARS 4.5; [ADR 0012](../adrs/0012-deviation-baseline.md) defines its baseline lifecycle. Read the relevant subset before implementing or reviewing an observable port behavior, including UI workflows, defaults, command availability, persistence, host interactions, and engine results. Current `src/` is authoritative for implemented behavior; the unchanged Java sources and oracle establish the legacy comparison. Reconcile stale ADR prose with the code while retaining decision rationale and clearly identifying supersession or historical evidence.

- **Classify the difference.** Use the UI or Engine subset, and within it the behavioral/functional or browser/platform subgroup. A cross-boundary feature may link related entries without duplicating its contract. Pending implementations belong in the plan/limitations; minor styling and oracle-conforming refactors do not get deviation entries. An intentional removal/replacement of a workflow is different from pending implementation and must be recorded.
- **Record the actual contract.** Add or update a stable catalog entry in the same change, naming the legacy and current behavior, user impact, source paths, corresponding ADR, and evidence. Reuse an ADR when its decision covers the change; add a focused ADR for a new consequential choice. Keep the implementation guide and owning module README consistent. When a change restores parity, explicitly retire or amend the entry rather than leaving it as current behavior.
- **Keep evidence honest.** A newly implemented deliberate divergence needs an appropriate regression/fixture and decision. Retrospective audits may disclose source-confirmed differences with explicit test gaps; source comparison is not an oracle result. Investigate unexplained mismatches rather than silently blessing them as enhancements. Record unresolved decisions without changing runtime behavior outside the task's scope.
- **Respect the release boundary.** Before 1.0 is cut, maintain the living catalog. At the human-owned release cut, reconcile against the release source and record its identifier/revision and evidence; do not perform Git writes merely to document the baseline. After the cut, preserve the frozen comparison and use later ADRs for net enhancements, regressions, and compatibility changes relative to 1.0. Label corrections to historical records explicitly.
- **Keep the catalog readable.** Preserve the nested subgroup headings and stable IDs with four-digit numbering (`UI-0001`, `UI-P0001`, `ENG-0001`, `ENG-P0001`); do not add a contents section or TOC. Link it from the root README and decision index. Run the affected docs/harness gates, and report unrun behavioral checks accurately. A delegated role without documentation ownership reports the exact entry/ADR update needed to its coordinating owner.

## Legacy documentation

The MARS 4.5 Javadoc and its supporting files under [_legacy-app/docs/](../../_legacy-app/docs/README.md) and help pages (`_legacy-app/help/`) are legacy reference material. Do not edit the generated files or help pages. When the port needs user-facing help, write new content for the web app and credit the original where text is adapted; the help pages are MIT-licensed with the rest of MARS.

## Help companions

In-app Help under [src/lib/help/](../../src/lib/help/README.md) and the [Markdown companions](../../src/lib/help/markdown/README.md) are duplicative, hand-maintained coverage of the same content. Update both in the same change whenever a documented workflow, default, availability note, example, link, or attribution changes. This applies to engine and UI work as well as documentation-only edits. Historical records and explicitly labeled legacy material stay intact in both formats. The immediate Overview and About content in [HelpArticle.svelte](../../src/lib/help/HelpArticle.svelte) is paired with `Overview.md` and `About.md`; other HTML/Markdown pairs share a basename. Do not introduce Markdown-to-HTML generation or a synchronization pipeline without an explicit request.

Preserve equivalent meaning using each format's native structure: headings, lists, fenced code blocks, and GitHub Markdown tables. Retain table headers, rows, register contracts, statuses, and availability; use `<br>` within Markdown cells when line breaks clarify multi-part values. Replace HTML layout tables with sections and smaller data tables rather than reproducing nested tables. Preserve the displayed assembly examples verbatim, dates, credits, and MIT attribution. Use repository-relative links for local resources, including the license. When adding or renaming an article, update both versions, the companion index, and the catalog's `markdownFile` mapping together. Read Online links target the corresponding Markdown file on the repository's `main` branch; local work must be published there by the human before those new destinations become available online.

Run the Help catalog tests and affected browser scenarios alongside the required app and documentation gates. Catalog checks cover destination existence, displayed code examples, and syscall service-table cells; prose and table equivalence still require review.

## Attribution

Every ported source module and every copied legacy data file carries the MARS copyright notice (Pete Sanderson and Kenneth Vollmar, MIT) in a header comment, alongside a line naming the legacy file it derives from. Derived assets retain attribution as well. Wholly original browser integration code containing no substantial copied or translated source does not need a legacy-source header; transformation alone does not remove attribution obligations for substantial portions ([ADR 0002](../adrs/0002-port-fidelity.md)). [MARSlicense.txt](../../MARSlicense.txt) stays at the repository root through offboarding.

## Documentation version policy

This policy applies to READMEs, ADRs, `AGENTS.md`, `docs/agents/`, `.agents/`, `.claude/`, `.codex/`, and dependency-version claims in comments.

- Prose names dependency, runtime, framework, and tool **major versions only**. Exact minor and patch versions belong only in executable configuration, manifests, lockfiles, container feature pins, workflow inputs, and generated artifacts.
- A dependency upgrade must check every duplicated pin (for example the Node and JDK majors in both `devcontainer.json` and `verify.yml`) and audit prose for affected claims.
- A minor or patch upgrade does not change prose. A major upgrade updates every affected major-version reference in the same change.
- Reviewers reject minor or patch versions in prose and flag a major-version reference that no longer matches configuration. MARS's own version (4.5) and MIPS architecture terms are product facts, not dependency pins, and are exempt.

### Standing do-not-bump notes

- **The JDK stays on 21 until offboarding.** It is the oracle's toolchain; changing it changes nothing the port ships but can change oracle output (for example float formatting or `java.util.prefs` behavior). If it must change, regenerate the golden fixtures in the same change and review every diff.
- **The global TypeScript feature stays on 6** until the scaffolded app's lint and check tooling supports a newer major.
