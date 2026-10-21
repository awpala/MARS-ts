# Shared implementation and review conventions

Read this guide for implementation, refactoring, and code review. It holds the shared ownership, organization, and working rules; load the [legacy](legacy.md) or [application](app.md) guide only for the boundary the task touches.

## Non-negotiables

- **The legacy Java tree is read-only** ([legacy guide](legacy.md#the-legacy-tree-is-read-only)). Port work reads it and runs it; it never changes it.
- **Every exported declaration and public API member is documented, without exceptions.** Use JSDoc for TypeScript declarations and public members, and Svelte `@component` documentation and documented props for components. Documentation describes the actual contract, including state ownership and teardown where applicable. When a unit ports a legacy class, name the Java source it ports (`Ports mars/mips/hardware/Memory.java`) so reviewers can compare. Source provenance in ported headers and copied assets uses paths relative to `_legacy-app/`; repository Markdown links resolve to the full relocated path.
- **Parity claims need evidence.** A ported behavior is "matching" only when a golden fixture produced by the oracle passes against it. Say "untested against the oracle" otherwise.
- **Project identifiers have distinct roles.** `MARS` is the display name, `mars-ts` the machine slug, `awpala` the repository owner. Keep the local port `6277` aligned across Vite, the devcontainer, and `kill-app` ([project scope](project.md#identity)).
- **Never run a `git` write command** (add, commit, push, branch, switch, checkout, merge, rebase, reset, restore, tag, stash, clean) unless the human explicitly asks in that turn. Git history is human-owned.

## Forbidden patterns

These are hard constraints at review time; a change containing one is blocked until ownership and teardown are explicit.

- **Process-wide simulator state.** Porting a Java static (`Globals`, `RegisterFile`, `Memory`) as a module-level mutable singleton. Impact: two sessions, two tabs' worth of SSR renders, or two tests share one machine state.
- **Engine imports of UI or platform.** Engine code importing Svelte, SvelteKit, or DOM APIs, or calling `console`, `prompt`, `fetch`, timers, or audio directly instead of through an injected host interface. Impact: the engine can no longer run in Vitest, the parity runner, or a Web Worker.
- **Unreleased subscriptions.** Registering memory, register, or simulator listeners without returning and calling an unsubscribe. Impact: duplicate updates and leaked sessions after navigation or reset.
- **Unexplained divergence.** Changing observable behavior relative to MARS without an ADR and a fixture recording it.

## Module organization

Keep one class per file, together with the helpers and types describing that class's contract. Pure functions need no class, and a small helper needs no separate file merely to satisfy a size target. Related records may stay together when they describe one cohesive contract.

The port translates existing Java algorithms and class responsibilities rather than inventing replacements. Retain corresponding TypeScript class names and public behavior, preserving method names where practical. The Java package structure is the starting map; any necessary split or merge must retain behavior and have its source mapping and rationale recorded in the module's README ([ADR 0002](../adrs/0002-port-fidelity.md)).

Subfolders name a responsibility (`assembler/`, `hardware/`, `instructions/`, `syscalls/`, `simulator/`, `formatting/`); translated engine code follows the Java responsibility map rather than collecting into `common/`, `shared/`, or `misc/` folders. Stateless helpers belong in the owning module's `utils/` directory, such as the [Venus utilities](../../src/lib/venus/utils/README.md), or beside the data owner they describe. Extracting general-purpose helpers is encouraged where warranted: when two or more callers repeat the same logic, share one implementation even if the logic is generic (clamping, error text, notation parsing) rather than a domain rule. Skip extraction when similar-looking copies encode different rules, and keep instance state and teardown with their owners. When moving code, update every importer and remove the old path; do not leave forwarding files or barrel exports at retired paths. The [module-organization skill](../../.agents/skills/module-organization/SKILL.md) carries the full checklist.

## Working in this repository

- **Edit, don't recreate.** Prefer modifying existing files over scaffolding new ones. Before adding a helper, search for one that already exists.
- **Match the file's style.** Prettier and ESLint configuration own formatting. Indent with two spaces everywhere, including generated files and scripts; never introduce tab indentation (`npm run format:check` enforces it). Use normal project indentation for class, interface, and type members. Format generated or extracted code immediately after writing it; do not leave generated source unformatted. Never argue with a formatter, and never run one over the legacy tree.
- **Comments preserve contracts and reasoning.** Put documentation comments on their own lines immediately above the declarations or members they document. Never put a declaration or other code on the same line as a documentation comment's closing `*/`, including the closing line of a multiline comment. Prefer clear names to comments that repeat statements. Public API documentation stays mandatory, and provisioning/configuration files keep comprehensive inline explanations.
- **Do not leave vestigial comments on code removal.** A removal is net-reductive; history lives in Git, not in commentary.
- **Do not add backwards-compatibility shims** for retired internal paths. Update callers together.
- **Exercise UI changes** with `npm run test:browser` on port `6278` before reporting them done. Port `6277` is exclusively for the human; agents must not start, stop, request, or test against that listener. For ad hoc agent servers (manual probes, screenshots, smoke checks), bind port `6279` or higher, for example `npm run dev -- --mode browser-test --port 6279`, stop only that process afterwards, and do not run it alongside `npm run test:browser`, which shares its isolated build output. Set `MARS_VALIDATION=1` for aggregate app gates to keep generated output separate.
- **Use American English** in all code, comments, docs, and commit messages.
- Markdown does **not** hard-wrap semantic paragraphs. One paragraph is one line, one bullet is one line. Fenced code blocks and diagram bodies keep their line structure.
- Relative Markdown links only. A link to a path that does not exist is a defect, and `run-checks harness` reports it.

## Commands and completion evidence

Run the affected gates within the user's environment limits: `run-checks` (or one tier: `harness`, `docs`, `legacy`, `app`), defined in [development operations](operations.md). Report each command and its result, every skipped tier, and anything you could not validate. A skipped tier is not a passed tier.
