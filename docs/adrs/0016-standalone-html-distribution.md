# ADR 0016: Manual standalone HTML distribution

- **Status**: Accepted; formal release integration deferred
- **Date**: 2026-11-16

## Context

The hosted static/PWA build requires an origin and adjacent assets ([ADR 0010](0010-pwa-offline-support.md)). The repository owner also wants one HTML file that opens directly in an existing desktop browser, including on a disconnected machine. The standalone target uses Kit's inline/hash output with embedded SVGs, an embedded license, and suppressed deployment-version probes. This decision establishes a maintained manual distribution without promising portable browser storage or a production browser matrix.

## Decision

[standalone/](../../standalone/README.md) owns maintained build/postprocessing/probe scripts and generated `MARS-ts.html`, which belongs in version control. The builder captures fresh inputs under ignored `__build/standalone/`, links installed dependencies, transforms only the copy, and publishes the HTML after build/postprocessing succeed. Hosted output and shared dependencies are unaffected. Node and the frontend toolchain are producer-side dependencies only.

Use SvelteKit 3's native inline bundle and hash router, remove incompatible prerender exports, omit hosted discovery links and service-worker registration, and embed SVG images/masks plus namespaced same-document toolbar definitions. Keep the complete canonical MIT license in the final HTML and expose it from embedded bytes through the existing Help link. Preserve original source and artwork notices. The favicon is optional and omitted in this distribution.

Kit's zero polling interval does not suppress focus/visibility deployment checks. A guarded Vite transform replaces the installed client's deployment-check guard only in the captured standalone build. It fails on unexpected source structure or a missing client transformation; shared installed code remains read-only. Review this pinned-toolchain adaptation on upgrades. Input-derived versioning avoids timestamp-only HTML changes.

Final HTML postprocessing installs document-lifetime normalization of optional relative links to published GitHub equivalents, including late-loaded Help. Public assets map to `static/`, Help document basenames to their Markdown companions, and ordinary repository paths to `blob/main`. Fragment/router links, explicit external destinations, embedded URLs, and downloads retain their meaning. No network fallback probe runs; online references require an intentional navigation and a connection. A resource policy prohibits network/sibling execution dependencies while allowing embedded script/style/images and optional external anchor navigation.

Save/Auto Save and recovery remain browser-storage workflows. Copying the HTML transports the application only; users must export sources before moving, renaming, or replacing it. File-origin storage behavior varies and may fail; no new in-memory fallback or portable project format is implemented. Help and its Markdown companions explain these limits.

Builds remain ad hoc and should generally accompany feature/asset development. Provision `build-standalone` as a live global command, with stdout/stderr logging, and retain npm entry points. Do not integrate standalone into CI, scheduled gates, publishing, or release workflows until MARS-ts 1.0 is finalized and the owner authorizes its formal release integration.

## Evidence and limits

The maintained [offline probe](../../standalone/scripts/check.mjs) opens the artifact alone after renaming it into a nested path containing spaces and non-ASCII characters, in a fresh offline Linux Chromium context without a server or security overrides. It checks desktop readiness, execution printing 42, Step/Backstep, all eleven articles and the full offline license, light/dark icons and SVG decoding, same-path reload recovery, source import and exact Blob export, link normalization, focus/visibility, and request/console/page-error auditing. [Node checks](../../standalone/scripts/build.test.mjs) cover fallback mappings, final postprocessing, and toolchain drift guards. These are packaging checks, not new oracle-parity evidence.

Other browsers/operating systems, denied/quota-limited storage, browser restart or path migration, native save dialogs, actual clipboard access, and audible audio remain unvalidated. Full release acceptance, persistence hardening, and browser support policy remain future release work. Existing engine limitations and the hosted service-worker lifecycle are unchanged. [UI-P0007](../deviations.md#ui-p0007-installable-offline-application-and-release-activation) records the platform adaptation alongside hosted delivery.
