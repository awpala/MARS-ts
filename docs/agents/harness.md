# Agent harness configuration and routing

Read this guide when changing agent instructions, Claude Code or Codex configuration, permissions, rules, skills, roles, or MCP servers. Ordinary port work starts at [AGENTS.md](../../AGENTS.md) and loads only the relevant specialty guide.

[AGENTS.md](../../AGENTS.md) is canonical for every coding assistant. `CLAUDE.md` is a relative symlink to it, so both tools enter through the same task directory. Shared policy belongs in `AGENTS.md` or one routed guide; tool-specific files hold only tool-specific syntax.

## Shared skills and roles

Everything vendor-neutral lives under `.agents/`. Tool adapters point at it rather than restating it.

**Skills.** Canonical skills live in [.agents/skills/](../../.agents/skills/), which Codex discovers natively. `.claude/skills/` is a byte-for-byte mirror for Claude Code: edit the canonical copy, then copy the tree (`rm -rf .claude/skills && cp -R .agents/skills .claude/skills`). `run-checks harness` fails when the two differ.

| Skill | Responsibility |
| --- | --- |
| [Legacy port](../../.agents/skills/legacy-port/SKILL.md) | Port one legacy unit to TypeScript with oracle evidence |
| [Svelte conventions](../../.agents/skills/svelte-core-bestpractices/SKILL.md) | Components, runes, snippets, reactivity, and lifecycle |
| [Svelte implementation](../../.agents/skills/svelte-code-writer/SKILL.md) | First-party documentation, analyzer, and validation workflow |
| [Module organization](../../.agents/skills/module-organization/SKILL.md) | Responsibility, ownership, legacy mapping, and coherent boundaries |
| [Review](../../.agents/skills/repo-review/SKILL.md) | Concrete defects, parity evidence, contract preservation, and validation gaps |

**Roles.** Canonical role definitions live in [.agents/agents/](../../.agents/agents/) as Markdown with `name` and `description` frontmatter. They hold each role's ownership and delegation boundary; the technical rules stay in the routed guides.

| Role | Owns | Writes |
| --- | --- | --- |
| [legacy-analyst](../../.agents/agents/legacy-analyst.md) | Questions about what MARS does | Nothing by default; assigned fixture files only |
| [core-porter](../../.agents/agents/core-porter.md) | The framework-free engine | Assigned engine modules, their tests, and fixtures |
| [svelte-file-editor](../../.agents/agents/svelte-file-editor.md) | Svelte components and SvelteKit routes | Assigned UI files |
| [code-reviewer](../../.agents/agents/code-reviewer.md) | Review | Nothing |

Adapters:

- **Claude Code** reads the same format natively, so each `.claude/agents/<role>.md` is a relative **file** symlink to `../../.agents/agents/<role>.md`. Use per-file links, not a directory link: host file sync has been observed to replace a directory symlink with an empty directory, while file symlinks such as `CLAUDE.md` survive.
- **Codex** uses TOML agent files. Each `.codex/agents/<role>.toml` carries the role's `name` and `description` and instructions that load the canonical definition; it never restates the rules.

`run-checks harness` requires both adapters for every canonical role and rejects adapters without one. To add a role or skill, add it under `.agents/` first, then the adapters, then a row in the tables above. Delegation is used only when the active task and environment permit it.

## Permissions

[Claude settings](../../.claude/settings.json) allow read-only repository inspection, the gates and helpers (`run-checks`, `tests`, `build-legacy`, `run-legacy`, the app's npm scripts), `npm ci`, and `java -version`/`javac -version`; they **ask** before Git writes, dependency changes (`npm install`, `npm uninstall`, `npm update`), `sv` project mutations, `npx`, and Docker; and they deny recursive deletion of the filesystem or workspace root. [Codex configuration](../../.codex/config.toml) limits writes to the workspace and enables network access for documentation and development; [Codex rules](../../.codex/rules/default.rules) mirror the same boundaries. Both tools let the stricter rule win. Runtime permission prompts do not replace the authorization rules in `AGENTS.md`.

The Codex rules are Starlark, which rejects tab indentation. Validate them after every edit with `codex execpolicy check --rules .codex/rules/default.rules <command>`, which also runs each rule's `match` and `not_match` examples; `run-checks harness` does this when the Codex CLI is installed. Restart the Codex session after changing rules.

## MCP servers

Both tools declare the first-party `svelte` MCP server; [tooling policy](tooling.md#mcp-servers) owns its source and the switch from Svelte's hosted endpoint to the pinned local server at P1. Never add community MCP servers or third-party plugins.

## Maintaining the harness

Behavioral comparison policy lives in the [documentation contract](documentation.md#deviation-catalog-maintenance), with the public baseline in [docs/deviations.md](../deviations.md). Port, UI, analyst, and review roles route there rather than maintaining separate catalogs. Roles limited to assigned code or read-only analysis report needed entry/ADR updates to their coordinating owner; those ownership limits do not make catalog maintenance optional for the overall change. Keep this routing in the canonical skills and their Claude mirror when adjusting the baseline workflow.

When moving guidance, update incoming links, section anchors, and plain-text routing hints in `AGENTS.md`, the guides, the roles, and the skills. Link checks alone do not prove that useful instructions survived a move. When the port reaches a milestone that changes a standing fact (P1 creates the app, P5 removes the legacy tree), update [project scope](project.md), the "current state" lines in `AGENTS.md` and [application engineering](app.md), and the role definitions in the same change.
