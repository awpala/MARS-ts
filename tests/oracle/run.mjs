#!/usr/bin/env node
/** Capture or verify the immutable Java oracle; never runs a TypeScript engine. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const legacyRoot = join(root, '_legacy-app');
const mode = process.argv[2];
if (process.argv.length !== 3 || !['--update', '--check'].includes(mode)) {
  console.error('Usage: node tests/oracle/run.mjs --update|--check');
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(join(directory, 'cases.json'), 'utf8'));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.cases) || !manifest.cases.length) {
  throw new Error('Unsupported or empty oracle case manifest');
}
const ids = new Set();
for (const fixture of manifest.cases) {
  if (
    fixture === null ||
    typeof fixture !== 'object' ||
    typeof fixture.id !== 'string' ||
    !/^[a-z0-9-]+$/.test(fixture.id) ||
    ids.has(fixture.id) ||
    typeof fixture.program !== 'string' ||
    !/^[a-z0-9-]+\.asm$/.test(fixture.program) ||
    !Array.isArray(fixture.options) ||
    !fixture.options.every((value) => typeof value === 'string') ||
    !Array.isArray(fixture.arguments) ||
    !fixture.arguments.every((value) => typeof value === 'string') ||
    (fixture.auxiliaryFiles !== undefined &&
      (!Array.isArray(fixture.auxiliaryFiles) ||
        !fixture.auxiliaryFiles.every(
          (value) => typeof value === 'string' && /^[a-z0-9-]+\.inc$/.test(value)
        ))) ||
    typeof fixture.stdin !== 'string' ||
    !Number.isInteger(fixture.expectedExitCode)
  ) {
    throw new Error(`Invalid fixture: ${JSON.stringify(fixture)}`);
  }
  ids.add(fixture.id);
}

// Always rebuild through the repository helper so stale Java classes cannot become goldens.
const build = spawnSync(join(root, '.devcontainer/scripts/bin/build-legacy.sh'), [], {
  cwd: root,
  encoding: 'utf8',
  timeout: 120_000,
  maxBuffer: 8 * 1024 * 1024
});
if (build.error || build.status !== 0) {
  process.stderr.write(build.stdout ?? '');
  process.stderr.write(build.stderr ?? '');
  throw build.error ?? new Error(`Oracle build failed: ${build.status}`);
}

// Hash source inputs, not the jar, whose zip timestamps change on every rebuild.
function javaFiles(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? javaFiles(child) : entry.name.endsWith('.java') ? [child] : [];
  });
}
// Provenance paths are relative to the Java app, independent of its checkout location.
const sourceFiles = [
  join(legacyRoot, 'Mars.java'),
  ...javaFiles(join(legacyRoot, 'mars')),
  ...['PseudoOps.txt', 'Config.properties', 'Settings.properties', 'Syscall.properties'].map(
    (name) => join(legacyRoot, name)
  )
].sort();
const digest = createHash('sha256');
for (const path of sourceFiles) {
  digest.update(relative(legacyRoot, path)).update('\0').update(readFileSync(path)).update('\0');
}
const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
if (java.error || java.status !== 0) throw java.error ?? new Error('Cannot record Java version');
if (!/version "21[."]/.test(java.stderr))
  throw new Error('Oracle requires the pinned JDK 21 major');
const provenance = {
  schemaVersion: 1,
  sourceSha256: digest.digest('hex'),
  sourceFiles: sourceFiles.map((path) => relative(legacyRoot, path)),
  javaVersion: java.stderr,
  normalization:
    'Replace the absolute repository root followed by / with <repo>/ in stdout and stderr; preserve every other byte.'
};
const goldenDirectory = join(directory, 'golden');
if (mode === '--update') mkdirSync(goldenDirectory, { recursive: true });
let failures = 0;
function compareOrWrite(name, bytes) {
  const path = join(goldenDirectory, name);
  if (mode === '--update') {
    writeFileSync(path, bytes);
    return;
  }
  let expected;
  try {
    expected = readFileSync(path);
  } catch {
    /* Report missing goldens as failures. */
  }
  if (!expected?.equals(bytes)) {
    console.error(`MISMATCH ${relative(root, path)}`);
    failures++;
  }
}
function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}
function normalize(bytes) {
  // Work on buffers, not decoded text: console output can contain arbitrary bytes.
  const needle = Buffer.from(`${root}/`);
  const chunks = [];
  let start = 0;
  let index;
  while ((index = bytes.indexOf(needle, start)) !== -1) {
    chunks.push(bytes.subarray(start, index), Buffer.from('<repo>/'));
    start = index + needle.length;
  }
  chunks.push(bytes.subarray(start));
  return Buffer.concat(chunks);
}
if (mode === '--update') compareOrWrite('provenance.json', jsonBytes(provenance));
else {
  const recorded = JSON.parse(readFileSync(join(goldenDirectory, 'provenance.json'), 'utf8'));
  // Capture the exact runtime for audits, but do not reject another JDK 21 patch/vendor
  // before comparing its actual output. CI and the container pin the major only.
  if (
    recorded.sourceSha256 !== provenance.sourceSha256 ||
    recorded.schemaVersion !== provenance.schemaVersion ||
    recorded.normalization !== provenance.normalization
  ) {
    console.error('MISMATCH oracle source provenance');
    failures++;
  }
}
for (const fixture of manifest.cases) {
  const program = `tests/oracle/programs/${fixture.program}`;
  const args = ['nc', 'ae2', 'se3', ...fixture.options, program];
  if (fixture.arguments.length) args.push('pa', ...fixture.arguments);
  const result = spawnSync(join(root, '.devcontainer/scripts/bin/run-legacy.sh'), args, {
    cwd: root,
    input: Buffer.from(fixture.stdin),
    timeout: 15_000,
    maxBuffer: 8 * 1024 * 1024
  });
  if (result.error || result.signal || result.status !== fixture.expectedExitCode) {
    process.stderr.write(result.stderr ?? Buffer.alloc(0));
    process.stderr.write(result.stdout ?? Buffer.alloc(0));
    throw (
      result.error ??
      new Error(
        `${fixture.id}: expected exit ${fixture.expectedExitCode}, received ${result.status}, signal ${result.signal}`
      )
    );
  }
  const inputDigest = createHash('sha256').update(jsonBytes(fixture));
  for (const name of [fixture.program, ...(fixture.auxiliaryFiles ?? [])]) {
    inputDigest
      .update(name)
      .update('\0')
      .update(readFileSync(join(directory, 'programs', name)))
      .update('\0');
  }
  const inputHash = inputDigest.digest('hex');
  compareOrWrite(`${fixture.id}.stdout`, normalize(result.stdout));
  compareOrWrite(`${fixture.id}.stderr`, normalize(result.stderr));
  compareOrWrite(
    `${fixture.id}.json`,
    jsonBytes({
      schemaVersion: 1,
      command: ['run-legacy', ...args],
      inputSha256: inputHash,
      exitCode: result.status
    })
  );
  console.log(`${mode === '--update' ? 'Captured' : 'Checked'} ${fixture.id}`);
}
if (mode === '--check') {
  const wanted = new Set([
    'provenance.json',
    ...manifest.cases.flatMap((fixture) =>
      ['stdout', 'stderr', 'json'].map((extension) => `${fixture.id}.${extension}`)
    )
  ]);
  for (const name of readdirSync(goldenDirectory))
    if (!wanted.has(name)) {
      console.error(`Unexpected golden: ${name}`);
      failures++;
    }
}
if (failures) process.exitCode = 1;
else
  console.log(
    `${manifest.cases.length} oracle cases ${mode === '--update' ? 'captured' : 'matched byte-for-byte'}.`
  );
