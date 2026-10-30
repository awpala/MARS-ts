# Browser workflow tests

This directory owns Playwright scenarios for the production [Venus desktop](../../src/lib/venus/README.md). The suite exercises source editing and persistence, assembly and debugging, console input, Help, shared controls, appearance, and asynchronous component lifetimes through the rendered application. The desktop's existing editor, engine, and state owners perform the work; tests observe controls, output, stored records, and downloaded content.

The user-supplied [Fibonacci program](fibonacci.asm) is a positive control for stepped/timed memory-write tracing: the first two stores highlight successive words, and the complete array ends in 55. A string-only summation scenario is the complementary negative control: assembly, console input, and string reads leave data memory unhighlighted. Execution scenarios also exercise reset highlighting, independent register banks, normal termination, address paging bounds, and the requested opening-page/center/final-page PC scrolling.

Settings scenarios cover memory-layout preview/application, opening-selection Reset and Cancel, automatic reassembly, delayed slots and Backstep, self-modifying execution, idle and checkpoint persistence, execution-time guards, every menu tooltip, automatic exception-handler library selection, plain-text filename display, independent enablement and selection, cancellation, persistence, running-state availability, trap/eret execution, handler-first notices, unsaved working text, missing sources, and loaded-handler recovery after preference changes, the bundled SPIM handler’s trap execution, protected reference/copy/recovery workflow, toolbar action placement, and the memory dialog’s column alignment and always-visible action footer.

[Program argument scenarios](program-arguments.spec.ts) cover the shared Args toolbar/menu setting, its position after Labels, the input row above the Text Segment table, draft and checkpoint recovery, literal quotes, and first-Go/Step initialization across Backstep, Reset, and pane changes.

[PWA scenario](pwa.spec.ts) checks that the page links a manifest and that its declared icons are served. The dev server neither bundles nor registers the service worker, so offline behavior is not covered by this suite; it is checked manually against a production build served by `vite preview` on port 6279 or higher ([ADR 0010](../../docs/adrs/0010-pwa-offline-support.md)).

[Source extension scenarios](source-extensions.spec.ts) cover the legacy assembly extensions `.asm` and `.s`: the import picker's `accept` value, importing files of both extensions in any letter case with exact stored text, listing other extensions as skipped with their reason in the import summary while committing only the assembly sources, offering nothing to commit when every selected file is skipped, and Export and Export All keeping a recognized extension in lowercase while giving other names `.asm` and numbering repeated flattened names. They decode the downloaded archive with the shared [archive reader](archive.ts), an independent ZIP reader that also verifies entry checksums and is reused by the desktop scenarios that inspect Export All.

[Button hover scenarios](button-hover.spec.ts) exercise the shared enabled-state highlight in both themes, including Delete Sources confirmation, dialog actions, console input, source and pane tabs, and disabled controls. Selected tabs retain their resting colors. The execution scenarios also check that a Text Segment row's Source link fills its whole cell, so hovering or clicking the cell's far corner, scrolled into view beside the default Labels pane, shows the link's highlight and "See in source file" tooltip and opens the source. A matching Labels scenario does the same for the name and address cells, including the empty side of each, and selects the label.

These scenarios complement the [TypeScript suites and Java oracle](../README.md). They establish browser integration behavior, while engine parity remains supported by the corresponding oracle comparisons.

## Server and browser ownership

The [Playwright configuration](../../playwright.config.ts) starts `npm run dev -- --mode browser-test` at `http://127.0.0.1:6278`. It refuses to reuse an existing server, runs scenarios fully in parallel, allows each scenario 60 seconds (about twice the slowest full-desktop scenarios measured on a loaded development container, including cold dev-server compiles and reloads), and uses a default viewport of 1280 × 900. A scenario may set a longer `test.setTimeout` only when it needs more than that default. Tests use Playwright's isolated page and browser context, so cookies and localStorage do not carry between scenarios.

The [Vite configuration](../../vite.config.ts) reserves port **6278** for validation and keeps its generated SvelteKit output in `__build/browser-kit`, Vite cache in `node_modules/.vite-browser-test`, and validation static builds in `__build/browser-site`. Port **6277** belongs exclusively to the human's own development review; agents never start, stop, or test against it, and ad hoc agent servers bind **6279** or higher. Run browser tests sequentially with application checks or builds that share the validation output, and leave the review server running independently.

## Running scenarios

From the repository root, with Node 24 and project dependencies installed:

```sh
npm run test:browser:install
npm run test:browser
```

The install command provisions Chromium and its system dependencies for a fresh environment. Playwright starts and manages the test server; no separate development-server command is needed. To select a scenario group or run it visibly:

```sh
npm run test:browser -- tests/browser/execution.spec.ts
npm run test:browser -- tests/browser/help.spec.ts --headed
```

Headed runs require a graphical display. Test artifacts go to `__build/browser-results`, with traces retained on failure. This suite targets the development server; passing it is not verification of a deployed static site or other browser engines.

## Readiness and setup

The shared [desktop helpers](openDesktop.ts) distinguish navigation from a usable session. `openDesktop(page)` visits the root route and waits for the New button to become enabled. `waitForDesktop(page)` performs the same readiness check after reload or another mounting path, allowing up to 30 seconds for hydration, source restoration, and machine initialization.

`openStoredSources(page, sources, selectedNames)` seeds committed records in `mars-ts:sources:v1`, then selects the requested names through the real Open dialog. It opens all supplied names by default. Call it after the desktop is ready; source selection and editor initialization remain application workflows. Tests of restoration, malformed preferences, or unavailable storage install their setup before navigation when the failure must affect mounting.

Most scenarios use the root route. Lifetime scenarios serve a test-owned empty page and load the [desktop mounting helper](../../src/lib/venus/mountDesktop.browser-test.ts), which mounts the production component and returns its actual teardown. Deferred file, clipboard, and save-picker operations let those tests control completion order, unmount during pending work, and verify that stale results cannot mutate a newer session, duplicate keyboard handling, or install listeners for a removed desktop. They also keep Help's injected code controls, with their focus and feedback, across a run-state change.

## Coverage and extension

| Area                       | Observable contracts                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source workflows           | Exact editor text, save and rename decisions, import/export of both assembly extensions, recovery, Auto Save, and storage failures                                                                                                                                                                                                                                      |
| Execution and debugging    | Assembly, stepping and backstep, breakpoints (including in-flight changes at finite speeds, the maximum-speed lock, retention across an identical rebuild, and the optional Clear all breakpoints confirmation), Clear all outputs on Go, register and memory edits, condition flag edits during stepping and execution, labels, console input, cancellation, and reset |
| Presentation and controls  | Keyboard commands, focus, modal dismissal, tooltips, pane geometry, theme persistence, machine-table stripes and highlights, and shared settings                                                                                                                                                                                                                        |
| Help and lifetimes         | Article availability and attribution, exact snippet transfers, clipboard feedback, stale asynchronous results, and teardown                                                                                                                                                                                                                                             |
| Runtime services and dumps | Random and dialog syscalls through same-tab dialogs, MIDI oscillators started from Go and released by Stop, and memory dumps through the save picker or download fallback with cancellation and write failures                                                                                                                                                          |
| Routes and installation    | Unknown-route fallback in both themes, plain-text crawler documents, and the web app manifest and its icons                                                                                                                                                                                                                                                             |

Add scenarios here when correctness depends on browser APIs, rendered interaction, focus, layout, persistence across reload, or component lifetime. Reuse the readiness helpers, prefer accessible roles and names for controls, and keep seeded records and browser API replacements local to each scenario. Assert observable results through production workflows; reserve lower-level algorithm and conversion cases for the TypeScript and oracle suites.

`syscalls.spec.ts` exercises random service dispatch through seeded integer output and bound errors, and all dialog families 50–59 through same-tab UI: focus, numeric/string conversion, typed messages, confirmation results, empty versus Cancel, explicit Stop, no echo, and exception-handler dispatch from an invalid random range. Its MIDI scenarios wrap the page's real `createOscillator` to record each started sine oscillator's frequency, context state, and scheduled stop: Go plays a MidiOutSync and a MidiOut tone from its gesture, waits at least the synchronous duration, and schedules each tone's fade-out; Stop during a long MidiOutSync tone ends the run before the next instruction without moving that tone's scheduled end. Exact seeded draw, MIDI argument, and raw memory/register parity live in the [method-probe comparison](../../src/lib/engine/syscalls/platform-syscalls.test.ts).

[Dump scenarios](dump.spec.ts) save every enabled legacy format through a stubbed OS save picker without changing source state, preserve choices after picker cancellation, keep write failures visible for retry, download raw binary bytes through the fallback, read live data after execution, omit unpopulated ranges, share the themed dropdown styling, and name files after the assembled build rather than the selected editor source. They also open the dialog with Ctrl+D or Meta+D from any focused surface once a program is loaded, confirm that the shortcut still suppresses the browser's default while the command is disabled, and check that the toolbar tooltip and File menu show the same keycaps. Exact encoder bytes are compared against the [Java dump fixture](../oracle/dump-units/README.md).
