import { readdirSync } from 'node:fs';

/** Discover semantic browser groups for both local Playwright projects and the CI matrix. */
export function browserSuites(): string[] {
  const root = new URL('../', import.meta.url);
  const entries = readdirSync(root, { withFileTypes: true });
  if (entries.some((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))) {
    throw new Error('Browser scenarios must belong to a semantic subfolder.');
  }
  const suites = entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        readdirSync(new URL(`${entry.name}/`, root), { recursive: true, encoding: 'utf8' }).some(
          (name) => name.endsWith('.spec.ts')
        )
    )
    .map((entry) => entry.name)
    .sort();
  if (
    suites.length === 0 ||
    suites.some((name) => !/^[a-z][a-z0-9-]*$/.test(name) || ['harness', 'startup'].includes(name))
  ) {
    throw new Error(
      'Browser groups need distinct kebab-case responsibility names outside harness/.'
    );
  }
  return suites;
}
