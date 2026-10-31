# Service worker

This directory owns the application's offline support: a single SvelteKit 3 service worker ([index.ts](index.ts)) that SvelteKit bundles to `service-worker.js` and registers automatically from the prerendered page. It exists so a visited origin keeps working without a network, which suits an app whose simulator makes no API requests and keeps all user data in the browser. The decision and its alternatives are recorded in [ADR 0010](../../docs/adrs/0010-pwa-offline-support.md).

## Relationships

The worker is one part of the installable-app surface. [manifest.webmanifest](../../static/manifest.webmanifest) describes the installed app (name, standalone display, relative `start_url` and `scope`, icons), and the root layout ([+layout.svelte](../routes/+layout.svelte)) links it. The 192 and 512 pixel icons under [static/icons/](../../static/icons/) are generated from the 50 × 50 [favicon](../../static/favicon.ico), so they are soft; replace them with higher-resolution art when it is available. The root [tsconfig.json](../../tsconfig.json) excludes this directory, and the local [tsconfig.json](tsconfig.json) extends SvelteKit's service-worker configuration so the worker is type-checked against worker globals rather than DOM types.

## Behavior

At install, the worker precaches the prerendered pages, the hashed Vite output, and the files from `static/` under a per-release cache named `mars-ts-<version>`. Manifest paths are relative to the deployment base, so the worker resolves them against its own registration scope; the app therefore works from a domain root or a subpath. On activation it deletes every other CacheStorage cache on the origin, including names outside the MARS prefix, as recorded in [ADR 0010](../../docs/adrs/0010-pwa-offline-support.md) and the [platform deviation catalog](../../docs/deviations.md#ui-p0007-installable-offline-application-and-release-activation).

Requests are handled as follows:

- **Precached files** are served cache-first.
- **Everything else** on the same origin is network-first. Successful responses are cached for later, and when the network fails the worker serves a cached copy if one exists.
- **Offline navigations** that have no cached copy fall back to the cached shell (the prerendered desktop), so any URL opens the app.
- **`_app/version.json`** and cross-origin or non-GET requests bypass the worker. SvelteKit's update polling therefore still sees new releases instead of a cached answer.

The worker deliberately does not call `skipWaiting`. A new release waits until every tab on the old one closes, so a running page never lazy-loads a chunk (for example a Help article) from a different release than its own, which would fail once the old cache is deleted.

The worker never touches `localStorage`, where sources, settings, and recovery state live. Browser data and the cache are both scoped to the origin, so installing the app or updating the worker neither migrates nor clears saved sources.

## Environment limits

Service workers require a secure context: `https` or `localhost`. They do not run from `file://`, so double-clicking `index.html` gives neither offline caching nor installation (see the deployment guidance in [IMPLEMENTATION.md](../../IMPLEMENTATION.md)). The development server does not bundle the worker; SvelteKit still registers it there as an unbundled module import of this entry, so offline behavior is checked against a production build. Verify offline behavior against a production build served by `vite preview` on a port of 6279 or higher. Port 6277 belongs to the human's own server and 6278 to the Playwright suite.

## Evidence

A production build served by `vite preview` on port 6279 was driven manually with Playwright: the worker activated, the release cache held 59 entries, and a reload with the network disabled rendered the desktop. This was a one-off manual check, not a committed test. The committed [pwa.spec.ts](../../tests/browser/pwa.spec.ts) runs against the development server and covers only the manifest link, its contents, and that its icons are served as PNG. Nothing in the suite asserts the worker's behavior, even though the development server registers it during these scenarios.

The deployed site was also checked manually in browser developer tools on October 22, 2026: the manifest returned 200, the worker was activated, and an offline reload rendered the application with the worker still running. The Manifest panel's only messages were two optional warnings about missing `screenshots` entries, which affect only the richer install dialog and are deliberately deferred.

## Changing the worker

Change the worker when the application gains runtime requests that are not static files (an API, remote assets, or a new Worker script), when the caching policy should differ for some class of request, or when the release-update behavior should change. Keep the precache set derived from SvelteKit's manifest rather than hand-listing files. Any such change revisits [ADR 0010](../../docs/adrs/0010-pwa-offline-support.md), and the deployment runbook's cache-header guidance, in the same change: `service-worker.js` and `manifest.webmanifest` must stay revalidated so releases are picked up.
