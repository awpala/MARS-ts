// Standalone builder: capture current inputs, embed trusted assets, and publish one HTML atomically.
// Run from any directory with Node and this checkout's installed dependencies; no runtime ships.
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  renameSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { createHash } from 'node:crypto';
import { postprocess } from './postprocess.mjs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Prettier resolves configured plugins from cwd; callers may invoke the global command anywhere.
process.chdir(root);
const output = resolve(root, '__build/standalone');
mkdirSync(output, { recursive: true });
const snapshot = mkdtempSync(resolve(output, 'app-'));
const release = resolve(root, 'standalone');
if (process.argv.length !== 2) throw new Error('Usage: node standalone/scripts/build.mjs');
for (const path of [
  'src',
  'standalone/scripts',
  'static',
  'tests',
  '.gitignore',
  'MARSlicense.txt',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'playwright.config.ts',
  'prettier.config.js',
  'eslint.config.js'
]) {
  cpSync(resolve(root, path), resolve(snapshot, path), { recursive: true });
}
symlinkSync(resolve(root, 'node_modules'), resolve(snapshot, 'node_modules'), 'dir');
// One existing unit test compares the bundled pseudo-op data with this read-only reference.
// Copy only its input; neither the Java runtime nor this file is part of the HTML release.
mkdirSync(resolve(snapshot, '_legacy-app'));
cpSync(resolve(root, '_legacy-app/PseudoOps.txt'), resolve(snapshot, '_legacy-app/PseudoOps.txt'));
const options = await resolveConfig(resolve(root, 'vite.config.ts'));

/** Format generated inputs immediately, without altering any original source. */
async function write(path, source) {
  const destination = resolve(snapshot, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, await format(source, { ...options, filepath: destination }));
}

/** Fail on source drift instead of silently building a partially transformed standalone build. */
function replace(source, before, after) {
  if (source.split(before).length !== 2) throw new Error(`Expected one occurrence of ${before}`);
  return source.replace(before, () => after);
}

/** Read only the isolated copy so every transformation has one captured input. */
function read(path) {
  return readFileSync(resolve(snapshot, path), 'utf8');
}

const svgUrls = {};
const glyphs = [];
const symbols = [];
for (const name of readdirSync(resolve(snapshot, 'static/icons')).sort()) {
  if (!name.endsWith('.svg')) continue;
  const svg = read(`static/icons/${name}`);
  // Only checked-in artwork is embedded. Reject external resources and active SVG content.
  if (
    /<(?:script|image|foreignObject)\b|\bon\w+\s*=|(?:href|url\()\s*=?\s*["']?(?:https?:|\/\/)/i.test(
      svg
    )
  ) {
    throw new Error(`Unsupported active/external SVG content in ${name}`);
  }
  svgUrls[`icons/${name}`] = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  if (!svg.includes('id="icon"')) continue;
  const parts = /^(.*?)<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/s.exec(svg);
  if (!parts || !/viewBox="0 0 24 24"/.test(parts[2])) {
    throw new Error(`Unexpected toolbar SVG structure in ${name}`);
  }
  const stem = name.slice(0, -4);
  const prefix = `mars-standalone-${stem}-`;
  const body = parts[3]
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}${id})`)
    .replace(/\bhref="#([^"]+)"/g, (_, id) => `href="#${prefix}${id}"`);
  symbols.push(parts[1] + body);
  glyphs.push(stem);
}

await write(
  'src/lib/browser/StandaloneSvgAssets.ts',
  `/** Trusted SVG bytes generated from static/icons, retaining the source notices in every data URL. */
const images: Record<string, string> = ${JSON.stringify(svgUrls)};
/** Resolve a bundled image or CSS mask without requesting a sibling file. Throws on missing artwork. */
export function embeddedSvg(path: string): string {
  const url = images[path];
  if (!url) throw new Error('Missing embedded SVG: ' + path);
  return url;
}
`
);

const icons = 'src/lib/venus/components/icons';
let toolbar = read(`${icons}/ToolbarIcon.svelte`);
toolbar = replace(toolbar, "  import { asset } from '$app/paths';\n", '');
toolbar = replace(
  toolbar,
  'href={`${asset(`icons/${name}.svg`)}#icon`}',
  'href={`#mars-standalone-${name}-icon`}'
);
toolbar = replace(
  toolbar,
  "References a bundled glyph's `#icon` group",
  'References an embedded, namespaced glyph group'
);
await write(`${icons}/ToolbarIcon.svelte`, toolbar);
for (const name of ['MaskIcon.svelte', 'Icon.svelte', 'ClipboardIcon.svelte']) {
  let source = read(`${icons}/${name}`);
  source = replace(
    source,
    "import { asset } from '$app/paths';",
    "import { embeddedSvg as asset } from '#lib/browser/StandaloneSvgAssets.js';"
  );
  await write(`${icons}/${name}`, source);
}

await write(
  'src/lib/browser/StandaloneLicense.ts',
  `/** Full canonical license, accessible in a new tab without a sibling file or network. The document owns this object URL until it closes. */
export const licenseUrl = URL.createObjectURL(new Blob([${JSON.stringify(read('MARSlicense.txt'))}], { type: 'text/plain;charset=utf-8' }));
`
);
let help = read('src/lib/help/HelpArticle.svelte');
help = replace(
  help,
  "import { asset } from '$app/paths';",
  "import { licenseUrl } from '#lib/browser/StandaloneLicense.js';"
);
if (help.split("asset('MARSlicense.txt')").length !== 3)
  throw new Error('Help license links changed');
help = help.replaceAll("asset('MARSlicense.txt')", 'licenseUrl');
await write('src/lib/help/HelpArticle.svelte', help);

let layout = read('src/routes/+layout.svelte');
layout = replace(layout, "  import { asset } from '$app/paths';\n", '');
layout = layout.replace(/<svelte:head>[\s\S]*?<\/svelte:head>\n/, '');
layout = replace(
  layout,
  'Root static application layout, preserving the original MARS favicon and linking the web app manifest.',
  'Standalone layout; the favicon and hosted discovery links are intentionally omitted.'
);
await write('src/routes/+layout.svelte', layout);
let page = read('src/routes/+page.svelte');
page = replace(
  page,
  '  <link rel="canonical" href="https://mars-ide.portfolio-projects.dev/" />\n',
  ''
);
await write('src/routes/+page.svelte', page);
await write(
  'src/routes/+layout.ts',
  '// Hash routing supplies the standalone entry; no SSR/prerender page options.\nexport {};\n'
);

let template = read('src/app.html');
template = replace(
  template,
  '<div style="display: contents">%sveltekit.body%</div>',
  `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="0" height="0"
    style="position:absolute;overflow:hidden;pointer-events:none" data-testid="standalone-svg-definitions">
    <defs>${symbols.join('\n')}</defs>
  </svg>
  <div style="display: contents">%sveltekit.body%</div>`
);
await write('src/app.html', template);

let config = read('vite.config.ts');
config =
  "import { standaloneRuntime } from './standalone/scripts/kit-runtime-plugin.mjs';\n" + config;
config = replace(config, 'tailwindcss(),', 'standaloneRuntime(),\n      tailwindcss(),');
// Stable input-derived version: identical captures produce identical distributable bytes.
const digest = createHash('sha256');
for (const directory of ['src', 'static', 'standalone/scripts']) {
  for (const name of readdirSync(resolve(snapshot, directory), { recursive: true }).sort()) {
    const path = resolve(snapshot, directory, name);
    if (statSync(path).isFile())
      digest.update(directory + '/' + name + '\0').update(readFileSync(path));
  }
}
for (const path of [
  'MARSlicense.txt',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'prettier.config.js',
  'tsconfig.json'
]) {
  digest.update(path + '\0').update(read(path));
}
const version = 'standalone-' + digest.digest('hex').slice(0, 20);

config = replace(config, "fallback: '404.html'", 'fallback: undefined');
config = replace(
  config,
  'compilerOptions: {',
  `version: { name: '${version}', pollInterval: 0 },
        output: { bundleStrategy: 'inline' },
        router: { type: 'hash' },
        serviceWorker: { register: false },
        compilerOptions: {`
);
await write('vite.config.ts', config);

console.log(`Prepared snapshot: ${snapshot}`);
console.log(
  `Embedded ${Object.keys(svgUrls).length} SVG images/masks and ${glyphs.length} toolbar glyphs.`
);
const metadata = { snapshot, release, version, glyphs, icons: Object.keys(svgUrls) };
execFileSync('npm', ['run', 'build'], {
  cwd: snapshot,
  env: { ...process.env, MARS_VALIDATION: '1' },
  stdio: 'inherit'
});
const html = resolve(release, 'MARS-ts.html');
const finished = await postprocess(read('__build/browser-site/index.html'), snapshot);
// Keep the previous tracked artifact intact if preparation/build/postprocessing fails.
const temporary = resolve(output, `MARS-ts-${process.pid}.html`);
writeFileSync(temporary, finished);
renameSync(temporary, html);
writeFileSync(resolve(output, 'latest.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(`Standalone: ${html} (${statSync(html).size} bytes)`);
console.log(`SHA-256: ${createHash('sha256').update(finished).digest('hex')}`);
