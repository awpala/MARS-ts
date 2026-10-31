# Browser workflow tests

This directory owns Playwright scenarios for the production [Venus desktop](../../src/lib/venus/README.md). The suite exercises source editing and persistence, assembly and debugging, console input, Help, shared controls, appearance, and asynchronous component lifetimes through the rendered application. The desktop's existing editor, engine, and state owners perform the work; tests observe controls, output, stored records, and downloaded content.

## Semantic groups

Scenarios live in groups named for their responsibility; shared setup and observation helpers live under the harness boundary. Keep new scenarios with the feature contract they exercise rather than adding specs at this directory's root.

| Group                            | Responsibility                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| [workspace](workspace/README.md) | Source-library operations, editing, naming, open-tab order, and import/export        |
| [execution](execution/README.md) | Assembly/debugging interaction, registers and memory, arguments, syscalls, and dumps |
| [shell](shell/README.md)         | Shared controls, menus, shortcuts, selection feedback, speed, and themes             |
| [session](session/README.md)     | Recovery, remounting, asynchronous completion, and teardown                          |
| [settings](settings/README.md)   | Preference application/persistence, memory configuration, and exception handlers     |
| [help](help/README.md)           | Help navigation, articles, links, loading, focus, and code transfers                 |
| [platform](platform/README.md)   | Route fallbacks, crawler documents, manifest metadata, and served icons              |
| [harness](harness/README.md)     | Shared readiness/setup, browser API stubs, domain locators, and archive inspection   |

The shared [suite discovery](harness/suites.ts) finds responsibility-named subfolders containing `.spec.ts` files, including nested specs, and supplies both local Playwright projects and the CI matrix. Names use kebab-case; `harness` and `startup` are reserved, and loose root specs are rejected. Add a new group only for a distinct responsibility, with its own README; discovery keeps local and CI membership aligned.

## Workflow coverage

The user-supplied [Fibonacci program](execution/fibonacci.asm) is a positive control for stepped/timed memory-write tracing: the first two stores highlight successive words, and the complete array ends in 55. A string-only summation scenario is the complementary negative control: assembly, console input, and string reads leave data memory unhighlighted. Execution scenarios also exercise reset highlighting, independent register banks, normal termination, address paging bounds, and the requested opening-page/center/final-page PC scrolling.

Settings scenarios cover memory-layout preview/application, opening-selection Reset and Cancel, automatic reassembly, delayed slots and Backstep, self-modifying execution, idle and checkpoint persistence, execution-time guards, every menu tooltip, automatic exception-handler library selection, plain-text filename display, independent enablement and selection, cancellation, persistence, running-state availability, trap/eret execution, handler-first notices, unsaved working text, missing sources, and loaded-handler recovery after preference changes, the bundled SPIM handler’s trap execution, protected reference/copy/recovery workflow, toolbar action placement, and the memory dialog’s column alignment and always-visible action footer.

[Program argument scenarios](execution/program-arguments.spec.ts) cover the shared Args toolbar/menu setting, its position after Labels, the input row above the Text Segment table, draft and checkpoint recovery, literal quotes, and first-Go/Step initialization across Backstep, Reset, and pane changes.

[PWA scenario](platform/pwa.spec.ts) checks that the page links a manifest and that its declared icons are served. Playwright blocks service workers for this development-server suite, so offline behavior is not covered; it is checked manually against a production build served by `vite preview` on port 6279 or higher ([ADR 0010](../../docs/adrs/0010-pwa-offline-support.md)). Ordinary development browsing still registers SvelteKit's unbundled worker.

[Source extension scenarios](workspace/source-extensions.spec.ts) cover the legacy assembly extensions `.asm` and `.s`: the import picker's `accept` value, importing files of both extensions in any letter case with exact stored text, listing other extensions as skipped with their reason in the import summary while committing only the assembly sources, offering nothing to commit when every selected file is skipped, and Export and Export All keeping a recognized extension while giving other names `.asm` and numbering repeated flattened names; lowercasing an uppercase extension is covered by the [export filename unit test](../../src/lib/venus/utils/sources/exportFilenames.test.ts). They decode the downloaded archive with the shared [archive helper](harness/archive.ts), an independent reader built on the system `unzip` tool that also verifies entry checksums. Desktop and settings scenarios reuse it to inspect Export All, and its DEFLATE archive builder supplies the desktop ZIP-import scenario.

[Button hover scenarios](shell/button-hover.spec.ts) exercise the shared enabled-state highlight in both themes, including Delete Sources confirmation, dialog actions, console input, source and pane tabs, and disabled controls. Selected tabs retain their resting colors. The execution scenarios also check that a Text Segment row's Source link fills its whole cell, so hovering or clicking the cell's far corner, scrolled into view beside the default Labels pane, shows the link's highlight and "See in source file" tooltip and opens the source. A matching Labels scenario does the same for the name and address cells, including the empty side of each, and selects the label.

The controls scenarios check transient function-key toolbar and console-clearing shortcut feedback, repeated activation, and disabled or modal-blocked commands.

These scenarios complement the [TypeScript suites and Java oracle](../README.md). They establish browser integration behavior, while engine parity remains supported by the corresponding oracle comparisons.

## Server and browser ownership

The [browser runner](harness/run.mjs), invoked by `npm run test:browser`, first collects the requested cases, then starts independent Playwright child processes for their semantic groups. Each group gets a copied application snapshot, its own server on an available port starting at `6278`, and its own `startup` check. The [Playwright configuration](../../playwright.config.ts) refuses to reuse an existing server. Tests within a file keep declaration order (`fullyParallel: false`). Local runs use one worker per group and allow two group processes concurrently on hosts with at least four available CPUs, or one on smaller hosts, reserving capacity for Vite, drivers, and renderers. Each selected CI group can parallelize files within the corresponding two-worker/one-worker budget. Each scenario has 60 seconds and a default viewport of 1280 × 900. Tests retain isolated pages and browser contexts, so cookies and localStorage do not carry between scenarios.

Preserve the shared 60-second scenario limit and 30-second desktop readiness wait. Investigate failures through traces and actual locator, application-state, harness, or implementation behavior before considering an exception. A longer explicit `test.setTimeout` requires a documented, intentionally long workload; it must not compensate for an unresolved failure or slow interaction. Existing workload-specific limits do not justify increasing other scenarios' deadlines.

The configured `serviceWorkers: 'block'` keeps worker precaching and cached responses out of these workflow scenarios. This is browser-context isolation for a suite that does not assert worker behavior; it does not alter the application's registration or production offline support. Worker/offline validation needs a separate production-build check with service workers allowed.

Once per invocation, the wrapper freezes `src/`, `static/`, `tests/browser/`, Playwright/Vite/TypeScript configuration, package metadata, and `.gitignore` under `__build/browser-runs/<run-id>/inputs`, where the run ID contains Unix seconds and the runner PID. Every queued group copies that same baseline into its private `<group>/app` directory. Its read-only `node_modules` link is the only shared runtime input; generated SvelteKit output and the `__build/browser-vite-cache` cache stay inside that snapshot. Root-owned results go to `__build/browser-results/<run-id>/<group>` and configured HTML reports to `__build/browser-report/<run-id>/<group>`; logs remain under root `__logs/__test-runs/`. Later working-tree application, test, harness, or configuration edits change neither active nor queued groups in that invocation; launch a new affected-group invocation to validate them. Keep captured inputs and shared installed dependencies unchanged while authorized work proceeds outside them. Port **6277** remains exclusively human-owned; ad hoc agent servers use available ports **6279** or higher.

Tailwind scans runtime source files under `src/`, excluding test/spec files; Markdown and browser tests do not trigger utility generation. Vite server stdout/stderr is piped into run evidence, preserving reload and invalidation messages for diagnosis.

## Running scenarios

From the repository root, with Node 24 and project dependencies installed, the unfiltered command runs the complete suite. Use it for broad validation assignments; local ad hoc feature work selects only the impacted projects/cases below. The configured CI matrix remains the full browser sentinel.

```sh
npm run test:browser:install
npm run test:browser
```

The install command provisions Chromium and its system dependencies for a fresh environment. Playwright starts and manages the test server; no separate development-server command is needed. To select semantic groups or run a specific file visibly:

```sh
npm run test:browser -- --project=execution
npm run test:browser -- --project=workspace --project=shell
npm run test:browser -- tests/browser/help/help.spec.ts --headed
```

Headed runs require a graphical display. Group results and retained failure traces live under `__build/browser-results/<run-id>/<group>`. Inventory-only `--list` runs create no application snapshots or browser sessions. This suite targets the development server; passing it is not verification of a deployed static site or other browser engines.

Capture each browser command's stdout/stderr according to the canonical [test run log contract](../../docs/agents/operations.md#test-run-logs), including targeted reruns, and preserve its exit status. These logs complement the configured traces and HTML reports; the contract includes a logged shell invocation.

The runner captures each child's complete stdout/stderr in `<timestamp>_<pid>_browser-<group>-runner.log` under `__logs/__test-runs/`, alongside collection evidence. The additive [project log reporter](harness/SuiteLogReporter.ts) writes `<timestamp>_browser-<project>-<pid>.log` for groups, their startup checks, and infrastructure events. It records starts, actual outcomes/errors, worker stdout/stderr, and summaries that distinguish `notRun` from completed results. A log-write failure fails validation; inventory-only `--list` runs create no project logs. Keep the configured reporters in normal invocations: local console output remains available, CI adds GitHub/HTML reports, and overriding `--reporter` would replace the project logger. Retain the master invocation log for wrapper/npm output as well.

## Failure triage and confirmation

Actively monitor the master and project logs during browser runs and give progress updates at least every 60 seconds. Report confirmed failures with their evidence, a concise cause or clearly labeled working hypothesis, and the prospective fix. Assign a dedicated monitor when the human explicitly requests one; its observation role does not authorize test or implementation edits.

1. Keep unaffected authorized group runs uninterrupted unless the human asks to stop them. Gather failed, interrupted, and `notRun` cases as groups finish; unrun cases provide no passing evidence.
2. Diagnose and fix actual causes in batches using logs and traces: locator scope, application state, harness contention, and implementation behavior. Preserve existing deadlines. Complete affected edits and fast gates before launching a fresh affected-group invocation. Authorized working-tree fixes and impacted-group reruns can proceed while unaffected snapshots continue; keep captured inputs and shared installed dependencies unchanged.
3. Rerun only impacted named projects or focused cases. Batch any remaining corrections, rerun the affected fast gates, and repeat focused confirmation until the impacted suites are clear.
4. For an explicitly broad validation assignment or human-requested local full pass, only then run complete sanity confirmation. A new sanity-pass failure returns to focused diagnosis before another full pass. Ad hoc feature work ends with the impacted subset confirmed; configured CI retains its complete sentinel on the existing triggers.
5. Report actual outcomes, skipped/unrun cases, checks, and log paths. A successful subset does not establish a complete-suite pass.

## Continuous integration

The separate [Browser tests workflow](../../.github/workflows/browser.yml) runs the suite on pushes to `main` and merge-queue `merge_group` events of type `checks_requested` targeting `main`. It does not run on ordinary feature-branch pushes or pull-request updates. The existing [Verify workflow](../../.github/workflows/verify.yml) keeps its push/pull-request triggers and harness, documentation, Java oracle, Vitest, and build gates.

A discovery job uses the same Node-only suite discovery as the local runner to build the semantic-group matrix. At most four group jobs run concurrently on separate Ubuntu runners, and a failed group does not cancel the other matrix jobs. Each job installs Node 24, `npm ci`, `unzip`, and Chromium/system dependencies through `npm run test:browser:install`, then runs the same snapshot wrapper through `npm run test:browser -- --project=<group>`. Its application, server, results, and startup check remain group-owned. The 30-minute job allowance covers provisioning and that group's files; the 60-second scenario and 30-second readiness deadlines remain independent and unchanged.

CI retains the configured GitHub, HTML, and project-file reporters. Each runner captures the complete command through `tee` with `pipefail`, preserving failures and a master log under `__logs/__test-runs/`. Non-canceled jobs upload available HTML reports, browser results/failure traces, and run logs as `browser-results-<group>`, retained for 14 days. The stable `Chromium browser suite` aggregate check requires discovery and every matrix group to succeed. Read actual outcomes, including setup failures and dependent scenarios that did not run, before claiming browser coverage passed.

Pre-merge execution depends on an available, configured GitHub merge queue and human-selected required status checks. Adding the workflow does not configure either setting. An ordinary Merge-button attempt without a queue does not invoke this pre-merge check; the eventual push to `main` invokes the browser workflow afterward. Repository settings remain human-owned.

## Readiness and setup

Each group process runs the `startup` project's [desktop setup](harness/desktop.setup.ts), opening one real desktop through `openDesktop(page)` against that group's captured application. An HTTP-ready server can still be compiling the cold client module graph; setup checks hydration and machine readiness first. It uses the same 60-second scenario limit and 30-second readiness wait as the workflows and retains traces on failure. A failed setup blocks its dependent group. Setup shares no page, context, cookies, localStorage, or saved session with later scenarios; each gets an isolated context and performs its own readiness check. Listing includes one shared startup entry, while execution performs startup once per selected group. Workflow cases remain unique; the extra startup checks explain why executed totals exceed the inventory total.

The shared [desktop helpers](harness/openDesktop.ts) distinguish navigation from a usable session. `openDesktop(page)` visits the root route and calls `waitForDesktop(page)`. Before navigating, it hides `showSaveFilePicker` so Export takes its cross-browser download-link path; scenarios that exercise Chromium's save picker install a recording stub with `stubSavePicker(page, result)` after opening. `waitForDesktop(page)` finds the controls fieldset through `getByTestId('desktop-controls')` and waits up to 30 seconds for its explicit `aria-busy="false"` readiness signal, then confirms New is enabled. The same check covers hydration, source restoration, and machine initialization after reload or another mounting path without repeatedly searching hidden controls by accessible name during startup.

`openStoredSources(page, sources, selectedNames)` seeds committed records in `mars-ts:sources:v1`, then selects the requested names through the real Open dialog. It opens all supplied names by default. Call it after the desktop is ready; source selection and editor initialization remain application workflows. Tests of restoration, malformed preferences, or unavailable storage install their setup before navigation when the failure must affect mounting.

Most scenarios use the root route. Lifetime scenarios serve a test-owned empty page and load the [desktop mounting helper](../../src/lib/venus/mountDesktop.browser-test.ts), which mounts the production component and returns its actual teardown. Deferred file, clipboard, and save-picker operations let those tests control completion order, unmount during pending work, and verify that stale results cannot mutate a newer session, duplicate keyboard handling, or install listeners for a removed desktop. They also keep Help's injected code controls, with their focus and feedback, across a run-state change.

## Locator contracts

Use reliable accessible roles, names, and labels for controls. Presentation containers, scrollers, table cells, and decorative subparts without an appropriate accessible identity have dedicated `data-testid` hooks consumed with Playwright's `getByTestId()`. Name hooks in kebab-case for the element's responsibility and place them on the element being observed. For example, the run-speed input retains its accessible control locator, while its surrounding controls and formatted caption have separate hooks:

```ts
const speed = page.getByRole('slider', { name: 'Run speed', exact: true });
const controls = page.getByTestId('run-speed-controls');
const caption = controls.getByTestId('slider-label');
```

Hooks are a shared contract with the rendered components. When markup changes, preserve the hook or update every consumer in the same change. Repeated rows and cells may share a static test ID: scope to a pane or row, then use a stable domain attribute, accessible name, or meaningful content to distinguish records. Do not construct hook names from incidental collection indices.

The shared [locator helpers](harness/locators.ts) combine repeated hooks with meaningful identity: `instructionRow(page, address)` finds a Text Segment row through its named breakpoint control even when addresses display in decimal; `memoryCell(page, address)` finds the cell around its named memory input; and `labelRow(container, name)` finds an exact label within its pane or symbol group. `expectButtonSequence(container, names)` checks consecutive accessible toolbar action names when their order is the contract, without selecting a neighboring element through DOM traversal.

`filter({ has: ... })` resolves its inner locator relative to each candidate, so use a descendant-only leaf locator rather than one prefixed by an ancestor pane or row. For nested parts, identify the domain row/container first, then follow its hooks:

```ts
const row = instructionRow(page, '0x00400000');
const source = row.getByTestId('text-source');
const link = source.getByTestId('text-source-link');
```

Do not find identity through CSS classes, style declarations, icon/asset URLs, XPath, ancestor/sibling traversal, or incidental `first()`, `last()`, `nth()`, and child positions. Add a dedicated hook for the desired container or subpart instead. Ordinal locators remain appropriate when ordering itself is the tested contract, such as the opening/final memory-page rows, or when enumerating homogeneous rendered content.

State selectors such as `data-highlight`, `data-selected`, and `aria-current` remain valid filters and assertions within a test-ID or accessible scope. CSS and class assertions are also valid when the scenario checks styling or feedback after identifying the element reliably. Queries for root `html`/`body`, manifest `meta`/`link` metadata, and deliberate semantic structure/content checks are appropriate; make the intended structure or ordering contract clear in the scenario. Keep geometry and layout assertions on the intended element without making its current nesting the locator contract.

Persistent hooks also remain attached when an element is hidden. Native `<details>` menus retain their content when closed, so `expect(page.getByTestId('menu-run-content')).toBeHidden()` checks closure; `toHaveCount(0)` would incorrectly require removal. Asserting the owning `<details>` has no `open` attribute is another valid state check.

`npm run lint` enforces `browser-tests/stable-locators` for TypeScript and MJS files in this directory through the [ESLint configuration](../../eslint.config.js). It checks string literals and template fragments passed to `locator`, `querySelector`, `querySelectorAll`, and `closest`, including DOM queries inside browser evaluations, and rejects classes, class/style attribute selectors, XPath or parent/root paths, and positional CSS selectors. Playwright ordinal methods remain available for the deliberate order/content assertions above. Dynamic selectors and the appropriateness of semantic or ordinal captures still require review against this contract.

## Coverage and extension

| Area                       | Observable contracts                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session startup            | A real desktop hydrates and enables New before semantic-group projects start; later scenarios independently verify readiness in isolated browser contexts                                                                                                                                                                                                               |
| Source workflows           | Exact editor text, save and rename decisions, import/export of both assembly extensions, recovery, Auto Save, and storage failures                                                                                                                                                                                                                                      |
| Execution and debugging    | Assembly, stepping and backstep, breakpoints (including in-flight changes at finite speeds, the maximum-speed lock, retention across an identical rebuild, and the optional Clear all breakpoints confirmation), Clear all outputs on Go, register and memory edits, condition flag edits during stepping and execution, labels, console input, cancellation, and reset |
| Presentation and controls  | Keyboard commands, focus, modal dismissal, tooltips, pane geometry, theme persistence, machine-table stripes and highlights, the editor's current-line highlight, and shared settings                                                                                                                                                                                   |
| Help and lifetimes         | Article availability and attribution, exact snippet transfers, clipboard feedback, stale asynchronous results, and teardown                                                                                                                                                                                                                                             |
| Runtime services and dumps | Random and dialog syscalls through same-tab dialogs, MIDI oscillators started from Go and released by Stop, and memory dumps through the save picker or download fallback with cancellation and write failures                                                                                                                                                          |
| Routes and installation    | Unknown-route fallback in both themes, plain-text crawler documents, and the web app manifest and its icons                                                                                                                                                                                                                                                             |

Add scenarios here when correctness depends on browser APIs, rendered interaction, focus, layout, persistence across reload, or component lifetime. Reuse the readiness helpers and locator contracts above, and keep seeded records and browser API replacements local to each scenario. Assert observable results through production workflows; reserve lower-level algorithm and conversion cases for the TypeScript and oracle suites.

`syscalls.spec.ts` exercises random service dispatch through seeded integer output and bound errors, and all dialog families 50–59 through same-tab UI: focus, numeric/string conversion, typed messages, confirmation results, empty versus Cancel, explicit Stop, no echo, and exception-handler dispatch from an invalid random range. Its MIDI scenarios wrap the page's real `createOscillator` to record each started sine oscillator's frequency, context state, and scheduled stop: Go plays a MidiOutSync and a MidiOut tone from its gesture, waits at least the synchronous duration, and schedules each tone's fade-out; Stop during a long MidiOutSync tone ends the run before the next instruction without moving that tone's scheduled end. Exact seeded draw, MIDI argument, and raw memory/register parity live in the [method-probe comparison](../../src/lib/engine/syscalls/platform-syscalls.test.ts).

[Dump scenarios](execution/dump.spec.ts) save every enabled legacy format through a stubbed OS save picker without changing source state, preserve choices after picker cancellation, keep write failures visible for retry, download raw binary bytes through the fallback, read live data after execution, omit unpopulated ranges, share the themed dropdown styling, and name files after the assembled build rather than the selected editor source. They also open the dialog with Ctrl+D or Meta+D from any focused surface once a program is loaded, confirm that the shortcut still suppresses the browser's default while the command is disabled, and check that the toolbar tooltip and File menu show the same keycaps. Exact encoder bytes are compared against the [Java dump fixture](../oracle/dump-units/README.md).
