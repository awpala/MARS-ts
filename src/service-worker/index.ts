/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { self } from '$app/service-worker';
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';

/**
 * Offline support for the static build. Everything the simulator needs (the prerendered page, the hashed
 * Vite output, and `static/` files) is precached under a per-release cache name, so a visited origin keeps
 * working without a network. The simulator performs no API requests, and all user data lives in
 * localStorage, which the cache never touches.
 */
const CACHE = `mars-ts-${version}`;

/** Pathname of the prerendered desktop document, the offline answer for every navigation. */
const SHELL = pathnameOf('/');

/**
 * Manifest paths are relative to the deployment base, which is the worker's scope (registered at
 * `./service-worker.js`). Resolving against it yields absolute pathnames matching `url.pathname`.
 */
function pathnameOf(path: string): string {
  return new URL(path.replace(/^\//, ''), self.registration.scope).pathname;
}

const PRECACHED = [
  ...new Set([...prerendered, ...immutable, ...assets].map(({ path }) => pathnameOf(path)))
];

const precached = new Set(PRECACHED);

/** `version.json` is Kit's update probe; serving it from a cache would hide new releases from the page. */
const isVersionProbe = (pathname: string) => pathname.endsWith('/_app/version.json');

self.addEventListener('install', (event) => {
  // No skipWaiting: a new release waits until every tab on the old one closes, so a running page
  // never lazy-loads a chunk (such as a Help article) from a different release than its own.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHED)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isVersionProbe(url.pathname)) return;
  event.respondWith(respond(request, url));
});

/** Serves precached files from the cache, navigations network-first with the shell offline, the rest network-first. */
async function respond(request: Request, url: URL): Promise<Response> {
  const cache = await caches.open(CACHE);
  if (precached.has(url.pathname)) {
    const hit = await cache.match(url.pathname);
    if (hit) return hit;
  }
  try {
    const response = await fetch(request);
    if (response.ok && !response.headers.get('cache-control')?.includes('no-store')) {
      void cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const hit =
      (await cache.match(request)) ??
      (request.mode === 'navigate' ? await cache.match(SHELL) : undefined);
    if (hit) return hit;
    throw error;
  }
}
