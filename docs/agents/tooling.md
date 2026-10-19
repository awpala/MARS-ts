# Versioned authority and first-party tooling

Determine exact language, runtime, framework, and dependency versions from manifests, lockfiles, toolchain files, and build configuration before selecting APIs. Public prose names major versions; executable configuration owns exact pins.

## Current authorities

| Toolchain | Authority |
| --- | --- |
| Node, global TypeScript, JDK, CLIs | Feature pins in [devcontainer.json](../../.devcontainer/devcontainer.json) and digests in [devcontainer-lock.json](../../.devcontainer/devcontainer-lock.json) |
| Svelte, SvelteKit, Vite, Tailwind, Vitest, project TypeScript | [package.json](../../package.json) and [package-lock.json](../../package-lock.json), created by the P1 scaffold |
| Legacy behavior | The Java sources and the oracle ([legacy guide](legacy.md)), not the MARS website or third-party forks |
| CI runtimes | [verify.yml](../../.github/workflows/verify.yml), which must match the container's Node and JDK majors |

The installed stack is Svelte 5, SvelteKit 3, Vite 8, Tailwind 4, Vitest 4, and TypeScript 6. The global TypeScript feature is pinned to major 6 because the planned SvelteKit lint and check tooling supports it; the app's own TypeScript devDependency becomes authoritative for its gates at P1.

## Authoritative implementation policy

1. Query the first-party Svelte MCP before introducing or materially changing Svelte or SvelteKit APIs, and analyze changed components with its autofixer. Inspect suggestions before applying them.
2. Prefer exact-version official documentation, then installed compiler and analyzer diagnostics, repository contracts, and official examples. A registry tag or community example cannot override them.
3. Documentation services may describe a different major than the one installed. Compare against the installed declarations and report the mismatch; do not introduce another major's APIs because an example uses them.
4. Treat documentation tools as read-only. They do not authorize remote or Git mutations.
5. Run the affected gates. Do not claim completion while a required gate fails.
6. Report the detected versions, the documentation and analyzers consulted, the commands run, and unresolved warnings. If a tool is unavailable, say so and rely on installed diagnostics instead of inventing its result.

## MCP servers

[.mcp.json](../../.mcp.json) (Claude Code) and [.codex/config.toml](../../.codex/config.toml) (Codex) declare the same first-party `svelte` server. Both configurations launch `/workspace/node_modules/.bin/svelte-mcp`, provided by the exact-pinned `@sveltejs/mcp` devDependency. Restart an existing MCP connection to select the local server; tools already connected to the hosted endpoint remain usable during the transition.

Agent tooling for a technology comes only from that technology's authors. Do not add community MCP servers, third-party plugins, or third-party skill installers. No first-party agent tooling is configured for Java; the legacy tree is read with ordinary file tools and the Red Hat Java extension in the editor.
