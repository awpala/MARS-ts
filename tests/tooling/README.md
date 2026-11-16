# Development-tool integration checks

This directory verifies that the repository's installed development tools can process the source constructs the application uses. Tests exercise public tool APIs with focused fixtures and, where useful, production source text; they do not instantiate application owners or duplicate the tool's implementation. Add checks here for tool compatibility regressions, while application behavior remains covered by the engine, session, and browser suites.

The Svelte MCP checks cover constructor parameter properties and enums in rune modules, ordinary components, and the desktop state modules that previously triggered an internal type-erasure error. A negative control requires a genuine compiler diagnostic at its original TypeScript location, so suppressing errors cannot satisfy the regression. Heuristic suggestions are permitted independently of compiler and analyzer errors.

Run `npm test -- tests/tooling/svelte-mcp.test.ts` for the focused checks or `npm test` for the full application suite. These checks use the exact-pinned first-party MCP package installed from the lockfile, with no documentation-server or browser connection. After updating that package, reconnect any already-running MCP client to load the installed version; a live server process retains its previously loaded code.
