# Standalone MARS

This module owns the manual single-file HTML distribution of MARS-ts: the generated [MARS-ts.html](MARS-ts.html), its build and postprocessing scripts, and the focused offline browser probe. It reuses the root application's engine, desktop, Help, and artwork; it contains no separately maintained application implementation. [ADR 0016](../docs/adrs/0016-standalone-html-distribution.md) records this secondary distribution decision.

Download or copy **MARS-ts.html itself**, then open it in an existing desktop browser. When downloading from GitHub, use **Download raw file**, since GitHub's file viewer does not execute the application. The HTML works offline without Node, Java, an interpreter, an installer, a local server, or adjacent files. Its JavaScript, styles, Help, icons, and full MIT license are embedded. The favicon is intentionally omitted. Optional Read Online and other external links require a connection; they are not application dependencies.

Save, Auto Save, preferences, and recovery use the browser's storage, outside the HTML.

> [!IMPORTANT]
> **Copying the HTML copies the application only. Export your sources before moving, renaming, or replacing it.** 

File-origin storage varies by browser/profile and may be unavailable or quota-limited; this distribution adds no session-only storage fallback. Import also needs writable source-library storage. Export All transports saved sources as ZIP, not a complete workspace/settings/debugger snapshot. The existing browser sandbox and download/picker behavior still apply.

## Build and validation

Use the root project's Node 26 and installed lockfile dependencies (`npm ci` when needed). Build from any directory with the provisioned `build-standalone` command, or from the repository root:

```sh
npm run build:standalone
```

The global command captures its output under `__logs/__test-runs/`; capture direct npm invocations and all checks there too:

```sh
mkdir -p __logs/__test-runs
build_log="__logs/__test-runs/$(date +%s)_standalone-build.log"
npm run build:standalone >"$build_log" 2>&1
```

Validate the finished artifact with installed Playwright Chromium (install separately with `npm run test:browser:install` if needed):

```sh
check_log="__logs/__test-runs/$(date +%s)_standalone-check.log"
npm run check:standalone >"$check_log" 2>&1
```

Each command returns its own exit status; inspect the saved log on failure. No server starts, and no port is used. `build-standalone` uses existing dependencies; it does not reinstall them or clean the hosted build. Fresh devcontainers provision the command automatically; existing containers can use npm immediately or refresh the command link as described in the [operations guide](../docs/agents/operations.md#manual-standalone-build).

The builder captures source, static assets, configuration, scripts, and validation inputs under ignored `__build/standalone/app-*`. It links shared dependencies read-only, formats transformed sources immediately, uses Kit's native inline/hash output, embeds all checked-in SVGs, and publishes `standalone/MARS-ts.html` only after successful build and postprocessing. `__build/standalone/latest.json` identifies the latest successful capture for optional diagnostics and snapshot checks. Input-derived versioning makes unchanged captured inputs stable; no Git command is invoked. Old captures may be removed manually when no build/check consumes them. Intermediate site output, caches, metadata, screenshots, and isolated test copies remain under ignored `__build/`; logs remain under ignored `__logs/`. **Only the generated HTML, maintained scripts, and this README belong in version control.**

Postprocessing normalizes relative document links to `awpala/MARS-ts` on GitHub's published `main` branch, maps public assets to `static/` and Help articles to their Markdown companions, and preserves fragments, external URLs, mail links, Blob downloads, and embedded data. It handles late-mounted content without probing the network. The Help license links open embedded text offline. A content security policy prevents external/sibling resource loads while allowing optional external anchor navigation.

Kit still checks deployment versions on focus/visibility when polling is disabled. A guarded, standalone-only Vite transform suppresses its deployment check before compilation. It never edits shared `node_modules`; source drift or a missing client transform fails the build. Review this adaptation when upgrading Kit rather than loosening its guards. The hosted application's behavior and build configuration stay intact.

`check:standalone` runs Node checks for link mapping, postprocessing, and the guarded Kit adaptation, then opens the finished HTML in a fresh offline Chromium context. The probe works without build metadata, so it can validate the checked-in HTML on a fresh checkout. It renames the file into an otherwise isolated nested directory containing spaces and non-ASCII characters, checks all embedded SVG images and toolbar glyphs in both themes, creates/assembles/steps/backsteps/runs a program printing 42, opens all eleven bundled Help articles and the full license, verifies same-path reload recovery, imports source, and compares exact exported bytes. Focus/visibility checks and all exercised workflows must produce no resource requests beyond the HTML navigations, console errors, or uncaught errors. Screenshots and request/error evidence stay ignored.

Validation currently targets Linux headless Chromium. Other browser/OS combinations, denied storage and quota failures, browser restart/migration, native picker interaction, actual clipboard access, and audible audio are not certified. Existing unfinished simulator features remain unfinished. This is packaging validation, not a new claim of Java-oracle parity.

## Maintenance and release boundary

Builds are ad hoc. Generally refresh and validate the HTML alongside application features or bundled-asset changes; report any deferred build or validation explicitly. Documentation-only and harness-only changes ordinarily need no rebuild. Keep build transformations, final postprocessing, and probes under `standalone/scripts/`; extend these owners when new bundled resources appear instead of adding application copies or runtime dependencies.

Do not add this target to CI, scheduled automation, release workflows, or publishing yet. Formal integration is deferred until MARS-ts 1.0 is finalized and released by the repository owner. The hosted/PWA build remains available independently.

MARS is copyright 2003–2013 Pete Sanderson and Kenneth Vollmar, MIT licensed. The artifact preserves original code/data/artwork notices and the complete [canonical license](../MARSlicense.txt).
