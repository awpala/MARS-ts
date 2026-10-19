# Versioned authority and first-party tooling

Determine exact language, runtime, framework, and dependency versions from manifests, lockfiles, toolchain files, and build configuration before selecting APIs. Public prose names major versions; executable configuration owns exact pins.

## Current authorities

| Toolchain | Authority |
| --- | --- |
| Node, global TypeScript, JDK, CLIs | Feature pins in [devcontainer.json](../../.devcontainer/devcontainer.json) and digests in [devcontainer-lock.json](../../.devcontainer/devcontainer-lock.json) |
| Svelte, SvelteKit, Vite, Tailwind, Vitest, project TypeScript | `package.json` and `package-lock.json`, **created at P1**; none exist yet |
| Legacy behavior | The Java sources and the oracle ([legacy guide](legacy.md)), not the MARS website or third-party forks |
| CI runtimes | [verify.yml](../../.github/workflows/verify.yml), which must match the container's Node and JDK majors |

Until P1, do not state a Svelte, SvelteKit, or Vite major anywhere; the [port plan](../adrs/0000-port-plan.md#2-planned-stack) names the intended stack without versions. The global TypeScript feature is pinned to major 6 because the planned SvelteKit lint and check tooling supports it; the app's own TypeScript devDependency becomes authoritative for its gates at P1.

## Authoritative implementation policy

1. Query the first-party Svelte MCP before introducing or materially changing Svelte or SvelteKit APIs, and analyze changed components with its autofixer. Inspect suggestions before applying them.
2. Prefer exact-version official documentation, then installed compiler and analyzer diagnostics, repository contracts, and official examples. A registry tag or community example cannot override them.
3. Documentation services may describe a different major than the one installed. Compare against the installed declarations and report the mismatch; do not introduce another major's APIs because an example uses them.
4. Treat documentation tools as read-only. They do not authorize remote or Git mutations.
5. Run the affected gates. Do not claim completion while a required gate fails.
6. Report the detected versions, the documentation and analyzers consulted, the commands run, and unresolved warnings. If a tool is unavailable, say so and rely on installed diagnostics instead of inventing its result.

## MCP servers

[.mcp.json](../../.mcp.json) (Claude Code) and [.codex/config.toml](../../.codex/config.toml) (Codex) declare the same first-party `svelte` server. Before P1 it is Svelte's hosted endpoint, `https://mcp.svelte.dev/mcp`, because there is no `node_modules` to run a local copy from. At P1, add `@sveltejs/mcp` as a pinned devDependency and switch both configurations to `/workspace/node_modules/.bin/svelte-mcp`, so the server version follows the lockfile.

Agent tooling for a technology comes only from that technology's authors. Do not add community MCP servers, third-party plugins, or third-party skill installers. No first-party agent tooling is configured for Java; the legacy tree is read with ordinary file tools and the Red Hat Java extension in the editor.
