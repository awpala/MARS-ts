# AGENTS.md

Guidance for AI coding agents working in this repository. Compatible with the [agents.md](https://agents.md/) convention. `CLAUDE.md` is a relative symlink to this canonical entry point; edit `AGENTS.md`, never replace the link with a second instruction document.

**MARS-ts** targets version 1.0 of the port of MARS, the MIPS Assembler and Runtime Simulator, from Java/Swing to a TypeScript SvelteKit web application. The original Java sources under `_legacy-app/` (`_legacy-app/Mars.java`, `_legacy-app/mars/`, and their resource files) are the **canonical behavioral reference**, regardless of legacy version labels: they are read, built, and run as an oracle, never edited. **Current state: core assembler, simulator, deterministic console syscalls, and desktop debugging are implemented. Oracle fixtures and browser assets are preserved; all six enabled legacy dump formats are implemented; remaining GUI settings, platform syscalls, and Tools are unfinished.** The [port plan](docs/adrs/0000-port-plan.md) is the authority for scope, stack, layout, milestones, and open decisions; [project scope](docs/agents/project.md) holds the identity and port values.

## Load guidance for the current task

The root [implementation guide](IMPLEMENTATION.md) describes the current system at module level. Keep it current as features are added or ported, following the [documentation contract](docs/agents/documentation.md#port-documentation); the root README remains a brief entry point.

Start here, then read only the guides whose scope matches the assignment. These are the detailed repository instructions, not optional summaries. Do not load every document under `docs/agents/`, every skill, or every ADR at startup. For a task crossing boundaries, load each affected specialty; follow further references when their subject is involved. Reuse guidance already read in the current context instead of reloading it through each referring skill.

| Task or responsibility                              | Detailed guidance                                                                        | When to load it                                                                         |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Check scope, identity, milestones                   | [Project scope](docs/agents/project.md) and the [port plan](docs/adrs/0000-port-plan.md) | Any port milestone work, identity values, or adding a top-level directory               |
| Read, build, or run the legacy Java MARS            | [Legacy reference and oracle](docs/agents/legacy.md)                                     | Understanding original behavior, producing golden outputs, Java-to-TypeScript semantics |
| Implement, refactor, or review code                 | [Shared workflow](docs/agents/workflow.md)                                               | Ownership, non-negotiables, module organization, and working conventions                |
| Application: Svelte, TypeScript, or styling         | [Application engineering](docs/agents/app.md)                                            | Engine/UI boundary, SSR isolation, component lifetimes, and app commands                |
| Select ecosystem APIs or change tooling             | [Versioned authority and tools](docs/agents/tooling.md)                                  | Pins, first-party MCPs, source precedence, and completion evidence                      |
| Write or review documentation and comments          | [Documentation contracts](docs/agents/documentation.md)                                  | READMEs, ADRs, provisioning comments, attribution, and version claims                   |
| Provisioning, helper commands, CI                   | [Development operations](docs/agents/operations.md)                                      | Dev container, setup script, gates, legacy helpers, and cleanup                         |
| Agent definitions, skills, or harness configuration | [Harness routing and maintenance](docs/agents/harness.md)                                | Role/skill selection, adapters, permissions, and MCP configuration                      |

Delegated roles are defined vendor-neutrally in [.agents/agents/](.agents/agents/): `legacy-analyst`, `core-porter`, `svelte-file-editor`, and `code-reviewer`. When you act as one of these roles or delegate to one, load its definition as well as the guides above. Each specialty links its applicable skills; the [complete skill and role directory](docs/agents/harness.md#shared-skills-and-roles) is available when selecting or maintaining one.

## Rules that apply to every task

- Respect the user's scope, existing authorization, and environment limits. Complete authorized local work; a configured tool or example command does not authorize unrelated remote, infrastructure, account, or Git mutations.
- **Never run a Git write command unless the human explicitly asks in that turn.** Git history is human-owned.
- **The legacy Java sources are read-only.** Never edit, reformat, or "fix" `_legacy-app/Mars.java`, `_legacy-app/mars/`, or the legacy resource files. They define the behavior being ported; a defect in them is recorded and, where the port deliberately diverges, decided in an ADR.
- **Parity before polish.** Port behavior is established by comparison with the legacy oracle ([legacy guide](docs/agents/legacy.md)). Do not claim a ported behavior matches MARS without oracle evidence.
- **Maintain the behavioral baseline.** Keep the [deviation catalog](docs/deviations.md) and corresponding ADRs aligned with current `src/` in the same change as observable port behavior. Separate UI/Engine behavior from browser/platform adaptations; exclude pending features, minor styling, and behavior-preserving refactors. Follow the [catalog maintenance contract](docs/agents/documentation.md#deviation-catalog-maintenance), including the freeze at the human-owned 1.0 release cut.
- **Preserve attribution.** MARS is MIT-licensed, copyright Pete Sanderson and Kenneth Vollmar. Ported code and copied data files keep that notice ([MARSlicense.txt](MARSlicense.txt)).
- **Keep project configuration consistent.** `MARS`, `mars-ts`, `awpala`, and the local dev/preview port `6277` (phoneword "MARS") are established values. Do not change them merely to make a check pass.
- **Do not implement ahead of the plan.** Add only the technologies and milestones the [port plan](docs/adrs/0000-port-plan.md) selects; record consequential choices as ADRs under `docs/adrs/`.
- **Never use port `6277`.** It belongs exclusively to the human's own development and testing; agents never start, stop, request, or test against it (including through `run-app`, `kill-app`, or a bare `npm run dev`/`npm run preview`). Automated browser tests use `6278`, and ad hoc agent servers use `6279` or higher ([development operations](docs/agents/operations.md)).
- **Validate within the authorized environment and report the evidence accurately.** Run the affected gates when available; do not claim deferred or skipped checks passed.
- **Keep documentation comments above their declarations on separate lines.** Never append code after their closing `*/`. Use project indentation for class, interface, and type members, and format generated or extracted code immediately after writing it ([shared workflow](docs/agents/workflow.md)).
- Use American English and repository-relative Markdown links. Keep semantic paragraphs on one line; preserve meaningful code and diagram line structure.

## Maintaining this directory

Add detailed guidance to the document that owns the responsibility and link it here when a new specialty warrants its own guide. Keep this entry point small by moving content, not deleting it. Update incoming links and role/skill references when moving a section, and preserve the [harness adapters and mirrors](docs/agents/harness.md) when changing their instructions.
