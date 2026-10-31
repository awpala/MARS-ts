# ADR 0010: Installable, offline-capable web app

- **Status**: Accepted
- **Date**: 2026-10-22

## Context

MARS-ts is a static application: the simulator runs entirely in the browser, performs no API requests, and keeps user data in browser-local storage ([ADR 0005](0005-coolify-deployment.md)). The built output is small and uses relative asset URLs, so it can be cached completely. Opening `index.html` from `file://` is not a supported way to run it: browsers block ES-module loading from opaque `file://` origins, and service workers require a secure context. Users who want a local or offline copy need a real origin, either the hosted site or `http://localhost`.

## Decision

Make the existing static build an installable Progressive Web App with SvelteKit's built-in service-worker support, adding no runtime dependency.

- [`src/service-worker/`](../../src/service-worker/README.md) is bundled and registered automatically by SvelteKit. It precaches the prerendered page, the hashed build output, and everything under `static/` in a cache named for the release version. On activation, the current implementation deletes every other Cache Storage name visible at that origin, not only names carrying the MARS prefix; this also removes prior release caches.
- Precached files are served cache-first. Other same-origin GET requests go to the network first and fall back to the cache; an offline navigation falls back to the cached desktop page. SvelteKit's `_app/version.json` update probe always bypasses the cache.
- The worker does not call `skipWaiting`. A new release takes over only after every tab on the previous release closes, so a running page never lazy-loads a chunk (such as a Help article) from a different release.
- [`static/manifest.webmanifest`](../../static/manifest.webmanifest) declares standalone display, relative `start_url` and `scope`, and 192 and 512 pixel PNG icons. The root layout links it. The PNG icons are generated from the retained MARS favicon.
- The worker never touches localStorage, so saved sources, settings, and session recovery are unaffected by cache updates.

## Consequences

After one online visit to the hosted site, or to a copy served from `localhost`, the application starts offline and can be installed from the browser. Opening `index.html` directly from `file://` remains unsupported; a local copy needs a static file server on `localhost`. Screenshots for the richer install dialog are deferred. A single-file build that works from `file://` and a packaged desktop wrapper remain undecided options.

Updates reach a user on the next visit after all tabs on the old release close, not instantly. Browser data stays scoped to the origin, so an installed copy from `localhost` and the hosted site hold separate sources; export/import is the migration path. The icons are a 50 × 50 favicon enlarged to 192 and 512 pixels, so they look soft until higher-resolution artwork replaces them. The Nginx configuration in the [runbook](../runbooks/prod-deployment.md) already revalidates non-hashed files, which covers `service-worker.js` and the manifest; browsers also bypass the HTTP cache for the worker script by default.

The development server does not bundle the worker, although SvelteKit still registers it there as an unbundled module. Offline behavior is verified against a production build served by `vite preview`; the committed browser suite covers only the manifest link and icons.

## Evidence

A production build previewed on port 6279 was driven with Playwright: the worker activated at the site scope, populated a version-named cache with 59 entries, and an offline reload rendered the desktop. This was a one-off manual check, not a committed test. `npm run check` and the service worker's own `tsc` project pass.

On October 22, 2026 the repository owner checked the deployed site in browser developer tools: `/manifest.webmanifest` returned 200, `/service-worker.js` showed as activated, and with the Network panel set to Offline a reload still rendered the application with the worker still running. The Manifest panel's only messages were two optional warnings that richer install UI needs `screenshots` entries (one with `form_factor` `wide`, one without); they do not affect installability or offline use, and screenshots are deliberately omitted for now because the layout targets desktop. This was a manual check, not a committed test. Offline persistence of saved sources was not part of it.
