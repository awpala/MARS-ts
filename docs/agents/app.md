# Application engineering conventions

Read this guide for port implementation and review: the framework-free simulator engine, Svelte components, SvelteKit routes, TypeScript boundaries, and styling. Use the [shared workflow](workflow.md) for ownership and organization, the [legacy guide](legacy.md) for Java semantics, and the [tooling policy](tooling.md) before choosing ecosystem APIs.

**The app is not scaffolded yet** (milestone P1 of the [port plan](../adrs/0000-port-plan.md#6-milestones)). The conventions below are binding from the first scaffolded file; references to `vite.config.ts`, `package.json`, and `src/` describe what P1 creates. When the scaffold lands, replace this paragraph with links to the real files and confirm every rule against the installed versions.

## Engine boundary

The simulator engine (assembler, instruction set, hardware, simulator, syscalls, dump formats) is framework-free TypeScript under `src/lib/engine/`, separate from components and routes. All application implementation lives under `src/`, with the package manifest and build configuration at the repository root. The port plan's [mapping table](../adrs/0000-port-plan.md#3-legacy-architecture-and-target-mapping) shows the intended modules.

- The engine imports nothing from `svelte`, `@sveltejs/kit`, `$app/*`, or DOM types. It runs unchanged in Vitest under Node, in the Node parity runner, in the browser, and in a Web Worker.
- **All I/O goes through injected host interfaces**: console output, input (which may be asynchronous), files, dialogs, audio, time, and randomness seeds. The browser UI, the parity runner, and tests each supply their own host.
- **State is per-instance.** A simulator session owns its memory, register file, coprocessors, symbol tables, and settings. Nothing in the engine is a mutable module-level singleton; immutable tables, such as the instruction definitions, may be module-level constants.
- **Change notification is explicit.** Memory, register, and simulator events are subscriptions that return an unsubscribe function. The engine never holds a reference to a component.
- **Bit-exact semantics** follow the [Java-to-TypeScript rules](legacy.md#java-to-typescript-semantics).

## Svelte 5

- **Runes only.** Use `$state`, `$derived`, `$effect`, `$props`, and `$bindable`. Do not use the Svelte 4 `$:` label, `on:` event directives, `export let`, legacy stores as primary state, or `<slot>`; use `{@render children()}` and snippet props.
- Component props: `let { foo, bar }: Props = $props();` with a **named local `type Props`** declared just above it, never an anonymous inline type and never `$props<T>()`. Every `Props` type and every property carries a JSDoc comment stating meaning, default, ownership, and any caller obligation. Type snippet props as `Snippet` from `svelte`.
- Prefer `$derived` over `$effect`; reserve `$effect` for side effects. Effects never run during SSR, so a `browser` guard inside an effect body is dead code.
- Use `$state.raw` for whole payloads that are only reassigned, such as register snapshots pushed from the engine; deep proxies on large memory views cost more than they track.
- Generate DOM ids with `$props.id()`.
- **Bridge engine subscriptions in one place.** A component or controller that subscribes to an engine session returns the unsubscribe as its `$effect` cleanup or `onMount` teardown. Releasing a session (reset, close, navigation) also stops its execution loop or Worker.
- **Module-scope state is per-process, not per-request.** Prerendering and development run SSR, so module-level `$state` is shared across renders. Keep sessions, editor buffers, and user settings inside the component tree or browser-only modules gated on `browser`.
- Reference: the `svelte` MCP server and the [`svelte-core-bestpractices`](../../.agents/skills/svelte-core-bestpractices/SKILL.md) skill.

## SvelteKit

- File-based routing under `src/routes/`. The planned adapter is static output with every page prerendered; the simulator runs entirely in the browser.
- The root route launches directly into the main GUI. Do not port `MarsSplashScreen` or introduce a splash or intermediary launch screen.
- Keep SvelteKit configuration where the scaffolded major expects it, and record that location here at P1. Do not add a second configuration file that duplicates it.
- Import shared modules through the package's declared subpath imports or SvelteKit's `$lib` alias, consistently, with whatever extension rule the scaffold's TypeScript configuration enforces.
- Internal links resolve through SvelteKit's typed path helpers rather than bare string paths.
- Vite's `server.port` and `preview.port` are `6277`, bound to all interfaces so the devcontainer's published port reaches them. Because the workspace is a host bind mount, the watcher polls (`server.watch.usePolling`).

## TypeScript

- Strict mode. Avoid `any`; use `unknown` with narrowing or a proper type.
- Keep `@types/node` on the same major as the Node runtime (24).
- Represent 32-bit machine words as `number` normalized with `| 0` or `>>> 0`, and 64-bit values as `bigint`. Name the convention in each engine module's README.

## Tailwind CSS

- Tailwind 4 through its Vite plugin; no `tailwind.config.js` or PostCSS configuration.
- Utility classes on elements; extract a Svelte component rather than `@apply` for repeated class lists.
- The Venus UI is the initial visual and functional reference: preserve its desktop layout, compact styling, pane arrangement, and workflows. Convert raster UI icons to SVG, retain the existing MARS favicon, use the browser file picker, and render application dialogs in the current tab ([ADR 0002](../adrs/0002-port-fidelity.md)).

## Commands

Once scaffolded, run from the repository root:

- `npm run dev`: the dev server on `6277` (alias `run-app`, which logs to `__logs/local/`).
- `npm run build` and `npm run preview`.
- `npm run check`: `svelte-kit sync` then `svelte-check`.
- `npm run lint` / `npm run lint:fix`, `npm run format` / `npm run format:check`.
- `npm run test`: Vitest, including oracle-fixture parity tests.

Gate: `check`, `lint`, `format:check`, `test`, and `build` must all pass (`run-checks app`). Type checking does not validate behavior; exercise UI changes in the dev server before reporting them done. Use the [Svelte implementation workflow](../../.agents/skills/svelte-code-writer/SKILL.md) for MCP analysis.
