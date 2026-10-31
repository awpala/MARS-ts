import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { readFileSync } from 'node:fs';

// Port 6277 belongs exclusively to the human developer. Browser tests isolate their server and generated files on 6278;
// ad hoc agent servers reuse that isolation with `--mode browser-test --port 6279` or higher.
export default defineConfig(({ mode }) => {
  const browserTest =
    mode === 'browser-test' || mode === 'test' || process.env.MARS_VALIDATION === '1';
  return {
    server: {
      host: '0.0.0.0',
      port: browserTest ? 6278 : 6277,
      strictPort: true,
      watch: { usePolling: true, ignored: ['**/__build/**', '**/__logs/**', '**/build/**'] }
    },
    preview: { host: '0.0.0.0', port: browserTest ? 6278 : 6277, strictPort: true },
    cacheDir: browserTest ? '__build/browser-vite-cache' : 'node_modules/.vite',
    // Embed the canonical static source without importing through SvelteKit's static-file middleware.
    define: {
      __MARS_SPIM_EXCEPTIONS__: JSON.stringify(
        readFileSync(new URL('./static/sources/exceptions.s', import.meta.url), 'utf8')
      )
    },
    plugins: [
      tailwindcss(),
      sveltekit({
        outDir: browserTest ? '__build/browser-kit' : '.svelte-kit',
        compilerOptions: {
          // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
          runes: ({ filename }) =>
            filename.split(/[/\\]/).includes('node_modules') ? undefined : true
        },
        adapter: adapter({
          // Static hosts serve this shell for unknown URLs; the router renders the global error page.
          fallback: '404.html',
          ...(browserTest ? { pages: '__build/browser-site', assets: '__build/browser-site' } : {})
        })
      })
    ],
    test: {
      // Bound CPU-heavy oracle suites while the human review server remains available.
      maxWorkers: 2,
      expect: { requireAssertions: true },
      projects: [
        {
          extends: './vite.config.ts',
          test: {
            name: 'server',
            environment: 'node',
            include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.test.ts'],
            exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
          }
        }
      ]
    }
  };
});
