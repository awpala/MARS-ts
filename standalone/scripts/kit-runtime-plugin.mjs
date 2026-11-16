/**
 * Suppress deployment probes in the standalone build only. Kit's pollInterval=0 still checks
 * focus/visibility, and there is no server deployment behind a carried HTML file. Transform
 * the installed client module instead of editing shared node_modules or intercepting fetch.
 * This deliberately narrow, pinned-toolchain adaptation fails the build if Kit's source drifts.
 * @returns {import("vite").Plugin} Standalone-only hooks with Vite-owned transform/build contexts.
 */
export function standaloneRuntime() {
  let transformed = false;
  return {
    name: 'mars-standalone-runtime',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/runtime/app/state/client.svelte.js')) return;
      const guard = 'if (DEV) return false;';
      if (code.split(guard).length !== 2) {
        throw new Error('SvelteKit update-check implementation changed; review standalone adapter');
      }
      transformed = true;
      return { code: code.replace(guard, 'if (true) return false;'), map: null };
    },
    generateBundle() {
      if (this.environment.name === 'client' && !transformed) {
        throw new Error('Standalone update-check adaptation was not applied');
      }
    }
  };
}
