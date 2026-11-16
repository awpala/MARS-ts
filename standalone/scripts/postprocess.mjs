import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'prettier';
import { installLinkNormalization, normalizeHref } from './normalize-links.mjs';

/**
 * Finish Kit's inline output with document-lifetime link normalization and an offline license.
 * The resource policy makes accidental network/sibling dependencies fail closed in future builds;
 * optional external anchor navigation remains available when the reader has a connection.
 */
export async function postprocess(html, snapshot) {
  const files = { 'MARSlicense.txt': 'MARSlicense.txt' };
  for (const name of readdirSync(resolve(snapshot, 'static'), { recursive: true })) {
    files[name] = `static/${name}`;
  }
  files['MARSlicense.txt'] = 'MARSlicense.txt';
  for (const name of readdirSync(resolve(snapshot, 'src/lib/help'))) {
    if (name.endsWith('.html')) {
      files[name] = `src/lib/help/markdown/${name.replace(/\.html$/, '.md')}`;
    }
  }
  const license = readFileSync(resolve(snapshot, 'MARSlicense.txt'), 'utf8');
  const script = await format(
    `(${installLinkNormalization.toString()})(${normalizeHref.toString()}, ${JSON.stringify(files)});`,
    { parser: 'babel', tabWidth: 2 }
  );
  if (script.includes('</script')) throw new Error('Unsafe inline postprocessor');
  if (!html.includes('</head>') || !html.includes('</body>')) throw new Error('Missing HTML shell');
  if (
    /<script\b[^>]*\bsrc\s*=|<link\b[^>]*rel=["'](?:stylesheet|modulepreload)|_app\/version\.json/i.test(
      html
    )
  ) {
    throw new Error('Standalone output still contains a script, stylesheet, or version dependency');
  }
  const withHead = html.replace(
    '</head>',
    `<!--\n${license}\n-->\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'">\n</head>`
  );
  // Kit's inline JavaScript includes an error-page template containing a literal </body>.
  // Insert at the shell's final closing tag, never inside that bundled template string.
  const bodyEnd = withHead.lastIndexOf('</body>');
  return withHead.slice(0, bodyEnd) + `<script>${script}</script>\n` + withHead.slice(bodyEnd);
}
