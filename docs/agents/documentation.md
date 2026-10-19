# Documentation contracts and version policy

Read this guide when writing or reviewing documentation, public API comments, provisioning explanations, or dependency-version claims. Its requirements apply across READMEs, decision records, and the agent harness.

## Port documentation

Application behavior is documented against the current implementation, never against what the port plan intends. Module READMEs and ADRs explain the port independently of the agent harness; never make a module README depend on a file under `docs/agents/`.

**A directory README describes a stable module boundary.** Lead with its responsibility, ownership, relationships, and extension criteria, even when it currently holds one file. For an engine module, also record **which legacy classes it ports**, the numeric conventions it uses (32-bit `number` versus `bigint`), and any deliberate divergence from MARS with a link to its ADR. Do not maintain exhaustive file, component, or export inventories that duplicate the source tree.

**Preserve explanatory depth.** When updating documentation, retain rationale, supported syntax, examples, comparison tables, lifecycle rules, failure modes, and operating procedures. Do not replace a detailed document with an outline because the current code is small.

**Separate evidence from intent.** The [port plan](../adrs/0000-port-plan.md) and open decisions describe intended work; READMEs describe what exists. Never copy a reference project's test results or guarantees as evidence about this repository, and never describe a parity claim as verified without the fixture that verifies it.

**Provisioning comments are part of the operational documentation.** Keep [setup-env.sh](../../.devcontainer/scripts/setup-env.sh), [devcontainer.json](../../.devcontainer/devcontainer.json), and the helper scripts comprehensively annotated: execution context, step ordering, tool choices, pin alignment, generated artifacts, failure handling, recovery, and which parts are provisional. Update comments when behavior changes; do not strip them as stylistic cleanup.

## Legacy documentation

The MARS 4.5 Javadoc (`docs/*.html`, `docs/mars/`, `docs/resources/`) and help pages (`help/`) are legacy reference material. Do not edit them. When the port needs user-facing help, write new content for the web app and credit the original where text is adapted; the help pages are MIT-licensed with the rest of MARS.

## Attribution

Every ported source module and every copied legacy data file carries the MARS copyright notice (Pete Sanderson and Kenneth Vollmar, MIT) in a header comment, alongside a line naming the legacy file it derives from. [MARSlicense.txt](../../MARSlicense.txt) stays at the repository root through offboarding.

## Documentation version policy

This policy applies to READMEs, ADRs, `AGENTS.md`, `docs/agents/`, `.agents/`, `.claude/`, `.codex/`, and dependency-version claims in comments.

- Prose names dependency, runtime, framework, and tool **major versions only**. Exact minor and patch versions belong only in executable configuration, manifests, lockfiles, container feature pins, workflow inputs, and generated artifacts.
- A dependency upgrade must check every duplicated pin (for example the Node and JDK majors in both `devcontainer.json` and `verify.yml`) and audit prose for affected claims.
- A minor or patch upgrade does not change prose. A major upgrade updates every affected major-version reference in the same change.
- Reviewers reject minor or patch versions in prose and flag a major-version reference that no longer matches configuration. MARS's own version (4.5) and MIPS architecture terms are product facts, not dependency pins, and are exempt.

### Standing do-not-bump notes

- **The JDK stays on 21 until offboarding.** It is the oracle's toolchain; changing it changes nothing the port ships but can change oracle output (for example float formatting or `java.util.prefs` behavior). If it must change, regenerate the golden fixtures in the same change and review every diff.
- **The global TypeScript feature stays on 6** until the scaffolded app's lint and check tooling supports a newer major.
