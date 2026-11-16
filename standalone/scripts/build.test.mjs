import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHref } from './normalize-links.mjs';
import { standaloneRuntime } from './kit-runtime-plugin.mjs';
import { postprocess } from './postprocess.mjs';
import { fileURLToPath } from 'node:url';

const files = {
  'icons/Help22.svg': 'static/icons/Help22.svg',
  'MarsHelpIntro.html': 'src/lib/help/markdown/MarsHelpIntro.md'
};
test('repository fallbacks preserve queries/fragments and escape filenames', () => {
  for (const [input, suffix] of [
    ['/MARSlicense.txt', 'MARSlicense.txt'],
    ['./icons/Help22.svg?raw=1#icon', 'static/icons/Help22.svg?raw=1#icon'],
    ['MarsHelpIntro.html', 'src/lib/help/markdown/MarsHelpIntro.md'],
    ['../docs/a%20b.md#section', 'docs/a%20b.md#section'],
    ['日本語.md', '%E6%97%A5%E6%9C%AC%E8%AA%9E.md']
  ]) {
    assert.equal(
      normalizeHref(input, files),
      `https://github.com/awpala/MARS-ts/blob/main/${suffix}`
    );
  }
});
test('fragments, external links, and embedded/download URLs remain intact', () => {
  for (const href of [
    '',
    '#icon',
    '#/',
    'https://example.com',
    '//example.com',
    'mailto:a@b.c',
    'blob:null/123',
    'data:text/plain,license'
  ]) {
    assert.equal(normalizeHref(href, files), href);
  }
});
test('Kit adaptation is narrow and fails on source/toolchain drift', () => {
  const plugin = standaloneRuntime();
  assert.equal(plugin.transform('if (DEV) return false;', '/other.js'), undefined);
  assert.throws(
    () => plugin.transform('changed', '/runtime/app/state/client.svelte.js'),
    /implementation changed/
  );
  assert.throws(
    () => plugin.generateBundle.call({ environment: { name: 'client' } }),
    /not applied/
  );
  assert.equal(
    plugin.transform(
      'async check() { if (DEV) return false; fetch("version.json"); }',
      '/runtime/app/state/client.svelte.js'
    ).code,
    'async check() { if (true) return false; fetch("version.json"); }'
  );
  assert.doesNotThrow(() => plugin.generateBundle.call({ environment: { name: 'client' } }));
});
test('postprocessing embeds the license and rejects unresolved runtime dependencies', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const html = await postprocess('<html><head></head><body></body></html>', root);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /Pete Sanderson and Kenneth Vollmar/);
  assert.match(html, /MutationObserver/);
  const bundledTemplate = '<script>const template = "</body>";</script>';
  const tricky = await postprocess(
    `<html><head></head><body>${bundledTemplate}</body></html>`,
    root
  );
  assert.ok(tricky.includes(bundledTemplate));
  assert.ok(tricky.indexOf('MutationObserver') > tricky.indexOf(bundledTemplate));
  for (const resource of [
    '<script src="app.js"></script>',
    '<link rel="stylesheet" href="app.css">',
    '_app/version.json'
  ]) {
    await assert.rejects(
      postprocess(`<html><head>${resource}</head><body></body></html>`, root),
      /dependency/
    );
  }
});
