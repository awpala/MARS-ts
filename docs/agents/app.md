# Application engineering conventions

Read this guide for port implementation and review: the framework-free simulator engine, Svelte components, SvelteKit routes, TypeScript boundaries, and styling. Use the [shared workflow](workflow.md) for ownership and organization, the [legacy guide](legacy.md) for Java semantics, and the [tooling policy](tooling.md) before choosing ecosystem APIs.

The application package is [package.json](../../package.json), with SvelteKit 3 configuration in [vite.config.ts](../../vite.config.ts) and strict TypeScript in [tsconfig.json](../../tsconfig.json). Svelte 5 runes, Tailwind 4, Vite 8, TypeScript 6, and Vitest 4 are installed; the lockfile fixes exact versions. The application lives under [src/](../../src/). P1 and P2 validation is complete; remaining web IDE and platform parity implementation continues.

## Engine boundary

The simulator engine (assembler, instruction set, hardware, simulator, syscalls, dump formats) is framework-free TypeScript under `src/lib/engine/`, separate from components and routes. All application implementation lives under `src/`, with the package manifest and build configuration at the repository root. The port plan's [mapping table](../adrs/0000-port-plan.md#3-legacy-architecture-and-target-mapping) shows the intended modules.

- The engine imports nothing from `svelte`, `@sveltejs/kit`, `$app/*`, or DOM types. It runs unchanged in Vitest under Node and in the browser, where it currently executes cooperatively on the main thread ([ADR 0004](../adrs/0004-cooperative-simulation.md)); the same boundary would let it move to a Web Worker without a rewrite.
- **All I/O goes through injected host interfaces**: source lookup, console output, input (which may be asynchronous), syscall dialogs, MIDI tones, scheduling, preferences, and randomness seeds today, and files and time when those syscalls are ported. The browser UI and the Vitest parity and unit suites each supply their own host.
- **State is per-instance.** A simulator session owns its memory, register file, coprocessors, symbol tables, and settings. Nothing in the engine is a mutable module-level singleton; immutable tables, such as the instruction definitions, may be module-level constants.
- **Change notification is explicit.** Memory, register, and simulator events are subscriptions that return an unsubscribe function. The engine never holds a reference to a component.
- **Bit-exact semantics** follow the [Java-to-TypeScript rules](legacy.md#java-to-typescript-semantics).

## Svelte 5

- **Runes only.** Use `$state`, `$derived`, `$effect`, `$props`, and `$bindable`. Do not use the Svelte 4 `$:` label, `on:` event directives, `export let`, legacy stores as primary state, or `<slot>`; use `{@render children()}` and snippet props.
- Component props: `let { foo, bar }: Props = $props();` with a **named local `type Props`** declared just above it, never an anonymous inline type and never `$props<T>()`. Every `Props` type and every property carries a JSDoc comment stating meaning, default, ownership, and any caller obligation. Type snippet props as `Snippet` from `svelte`.
- Prefer `$derived` over `$effect`; reserve `$effect` for side effects. Effects never run during SSR, so a `browser` guard inside an effect body is dead code.
- Use `$state.raw` for whole payloads that are only reassigned, such as register snapshots pushed from the engine; deep proxies on large memory views cost more than they track.
- Generate DOM ids with `$props.id()`.
- **Bridge engine subscriptions in one place.** A component or controller that subscribes to an engine session returns the unsubscribe as its `$effect` cleanup or `onMount` teardown. Releasing a session (reset, close, navigation) also stops its execution loop and releases its pending host operations.
- **Module-scope state is per-process, not per-request.** Prerendering and development run SSR, so module-level `$state` is shared across renders. Keep sessions, editor buffers, and user settings inside the component tree or browser-only modules gated on `browser`.
- Reference: the `svelte` MCP server and the [`svelte-core-bestpractices`](../../.agents/skills/svelte-core-bestpractices/SKILL.md) skill.

## SvelteKit

- File-based routing under `src/routes/`. The static adapter emits prerendered output; the simulator runs entirely in the browser, and the [service worker](../../src/service-worker/README.md) adds offline support ([ADR 0010](../adrs/0010-pwa-offline-support.md)).
- The root route launches directly into the main GUI. Do not port `MarsSplashScreen` or introduce a splash or intermediary launch screen.
- SvelteKit 3 takes configuration through `sveltekit(...)` in the root `vite.config.ts`; do not add a competing `svelte.config.js`. Imports use the declared `#lib/*` package subpath.
- Import shared modules through the package's declared subpath imports or SvelteKit's library alias, consistently, with whatever extension rule the scaffold's TypeScript configuration enforces.
- Internal links resolve through SvelteKit's typed path helpers rather than bare string paths.
- Normal development and preview use port `6277`, exclusively for the human. Agents must not start, stop, request, or test against that listener. `npm run test:browser` owns per-group application snapshots and available ports starting at `6278`, and ad hoc agent servers bind available ports `6279` or higher ([development operations](operations.md)); `MARS_VALIDATION=1` isolates other validation output under `__build/`. Browser-test mode and Vitest also use isolated generated files and dependency caches. The host bind mount uses polling (`server.watch.usePolling`).

## TypeScript

- Strict mode. Avoid `any`; use `unknown` with narrowing or a proper type.
- Keep `@types/node` on the same major as the Node runtime (24).
- Represent 32-bit machine words as `number` normalized with `| 0` or `>>> 0`, and 64-bit values as `bigint`. Name the convention in each engine module's README.

## Tailwind CSS

- Tailwind 4 through its Vite plugin; no `tailwind.config.js` or PostCSS configuration.
- Utility classes on elements; extract a Svelte component rather than `@apply` for repeated class lists. The application stylesheet explicitly scans runtime Svelte/TypeScript/JavaScript/HTML under `src/`, excluding test/spec files; Markdown, browser tests, and legacy files must not generate utilities or invalidate the stylesheet.
- The Venus UI is the initial visual and functional reference: preserve its desktop layout, compact styling, pane arrangement, and workflows. Convert raster UI icons to SVG, retain the existing MARS favicon, use the local source library for Open/Save and the browser file picker for Import, and render application dialogs in the current tab ([ADR 0002](../adrs/0002-port-fidelity.md)).

## Browser test selectors

Treat selectors shared by production components and [browser scenarios](../../tests/browser/README.md) as a maintained test contract. When editing a tested view, preserve its hooks or update the component and every affected consumer together.

Keep specs in their [semantic responsibility group](../../tests/browser/README.md#semantic-groups), with shared setup and observation under `tests/browser/harness/`. Use the named project commands and default reporters from the [suite guide](../../tests/browser/README.md#running-scenarios) so targeted runs preserve per-group logs and the shared local/CI discovery contract.

- Use reliable accessible roles, names, and labels for controls. For presentation containers, table cells, scrollers, decorative subparts, and other elements without a suitable accessible identity, add a dedicated `data-testid` and use Playwright's `getByTestId()`.
- Name hooks in kebab-case for their responsibility, independent of CSS classes, layout, generated DOM IDs, and icon paths. Put the hook on the actual element whose geometry, interaction, or content is tested. Pass caller-owned hooks through generic controls when the caller owns the identity.
- Repeated collections may reuse a static test ID. Scope to the owning pane or row, then distinguish members by stable domain attributes, accessible names, or meaningful content. `filter({ has: ... })` resolves its inner locator relative to each candidate: use a descendant-only leaf locator, without an ancestor pane or row prefix. Identify the domain row/container first, then find its hooked subparts. Do not encode the current array position into a hook to disguise an ordinal locator.
- Do not identify elements through CSS classes, style declarations, bundled asset URLs, XPath, parent/sibling traversal, or incidental `first()`, `last()`, `nth()`, and child positions. Add a hook to the intended owner or subpart instead. Ordinal selection remains valid when the order itself is the asserted contract or when enumerating homogeneous rendered content.
- Keep identity separate from state and presentation assertions. Scope `data-highlight`, `data-selected`, `aria-current`, and other meaningful state filters through a test ID or accessible locator. Native `<details>` menu content stays in the DOM when closed: assert `toBeHidden()` or the absence of the owner's `open` attribute rather than `toHaveCount(0)` on its persistent hook. CSS/class assertions remain valid when styling or visual feedback is the behavior being checked; they must not supply the element's identity.
- Root `html`/`body` inspection, manifest `meta`/`link` queries, and deliberate semantic structure/content checks remain appropriate. A selector that asserts a documented structure or ordering contract should make that purpose clear in the scenario.

The [ESLint configuration](../../eslint.config.js) enforces `browser-tests/stable-locators` for `tests/browser/**/*.{ts,mjs}` during `npm run lint`. It checks literal strings and template fragments in `locator`, `querySelector`, `querySelectorAll`, and `closest`, rejecting classes, class/style attribute selectors, XPath or parent/root paths, and positional CSS selectors, including queries inside browser evaluations. UI implementation and review must still apply the complete convention to dynamic selectors, asset-based identity, and incidental ordinal captures. Keep [the browser suite's locator guidance](../../tests/browser/README.md#locator-contracts) and the UI/review skill routing aligned when changing it.

## Commands

Run from the repository root:

- `npm run dev`: the human's dev server on `6277` (alias `run-app`, which logs to `__logs/local/`); agents do not run it.
- `npm run build` and `npm run preview` (preview also binds `6277`; agents pass `--port 6279` or higher).
- `npm run test:browser`: snapshot-isolated semantic-group runners on harness-allocated ports starting at `6278`; select impacted projects/cases for local feature work under the [browser validation scope](workflow.md#browser-validation-scope).
- `npm run check`: `svelte-kit sync` then `svelte-check`.
- `npm run lint` / `npm run lint:fix`, `npm run format` / `npm run format:check`.
- `npm run test`: Vitest, including oracle-fixture parity tests.

Gate: `check`, `lint`, `format:check`, `test`, and `build` must all pass (`run-checks app`). Type checking does not validate behavior; exercise UI changes through the impacted browser projects/cases under the [browser validation scope](workflow.md#browser-validation-scope). Existing CI retains its full browser sentinel. Use the [Svelte implementation workflow](../../.agents/skills/svelte-code-writer/SKILL.md) for MCP analysis.
