# Versioned authority and first-party tooling

Determine exact language, runtime, framework, and dependency versions from manifests, lockfiles, toolchain files, and build configuration before selecting APIs. Public prose names major versions; executable configuration owns exact pins.

## Current authorities

| Toolchain | Authority |
| --- | --- |
| Node, global TypeScript, JDK, CLIs | Feature pins in [devcontainer.json](../../.devcontainer/devcontainer.json) and digests in [devcontainer-lock.json](../../.devcontainer/devcontainer-lock.json) |
| Svelte, SvelteKit, Vite, Tailwind, Vitest, project TypeScript | [package.json](../../package.json) and [package-lock.json](../../package-lock.json), created by the P1 scaffold |
| Legacy behavior | The Java sources and the oracle ([legacy guide](legacy.md)), not the MARS website or third-party forks |
| CI runtimes | [verify.yml](../../.github/workflows/verify.yml), which must match the container's Node and JDK majors |

The installed stack is Node 26 LTS, Svelte 5, SvelteKit 3, Vite 8, Tailwind 4, Vitest 5, and TypeScript 6. Keep both project and global TypeScript on major 6 until the existing SvelteKit 3 / Svelte 5 toolchain, including svelte-check and typescript-eslint, supports TypeScript 7; the app's TypeScript devDependency and lockfile remain authoritative for its gates.

## Authoritative implementation policy

1. Query the first-party Svelte MCP before introducing or materially changing Svelte or SvelteKit APIs, and analyze changed components with its autofixer. Inspect suggestions before applying them.
2. Prefer exact-version official documentation, then installed compiler and analyzer diagnostics, repository contracts, and official examples. A registry tag or community example cannot override them.
3. Documentation services may describe a different major than the one installed. Compare against the installed declarations and report the mismatch; do not introduce another major's APIs because an example uses them.
4. Treat documentation tools as read-only. They do not authorize remote or Git mutations.
5. Run the affected gates. Do not claim completion while a required gate fails.
6. Report the detected versions, the documentation and analyzers consulted, the commands run, and unresolved warnings. If a tool is unavailable, say so and rely on installed diagnostics instead of inventing its result.

## MCP servers

[.mcp.json](../../.mcp.json) (Claude Code) and [.codex/config.toml](../../.codex/config.toml) (Codex) declare the same first-party `svelte` server. Both configurations launch `/workspace/node_modules/.bin/svelte-mcp`, provided by the exact-pinned `@sveltejs/mcp` devDependency. Restart an existing MCP connection to select the local server; tools already connected to the hosted endpoint remain usable during the transition.

After upgrading the pinned package, reconnect existing local MCP clients so their server processes load the new code. The [tooling integration checks](../../tests/tooling/README.md) exercise its public analyzer with constructor parameter properties, enums, real compiler diagnostics, and the production desktop state modules. Run these checks when updating the analyzer; do not rewrite valid application TypeScript to accommodate an analyzer crash or suppress its diagnostics.

Agent tooling for a technology comes only from that technology's authors. Do not add community MCP servers, third-party plugins, or third-party skill installers. No first-party agent tooling is configured for Java; the legacy tree is read with ordinary file tools and the Red Hat Java extension in the editor.
