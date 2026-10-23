import { execFileSync } from 'node:child_process';

/** Verify a downloaded ZIP archive and return its entries in stored order with their UTF-8 text. */
export function readArchive(path: string): { name: string; source: string }[] {
  execFileSync('unzip', ['-t', path]);
  const names = execFileSync('unzip', ['-Z1', path], { encoding: 'utf8' }).trimEnd().split('\n');
  return names.map((name) => ({
    name,
    source: execFileSync('unzip', ['-p', path, name], { encoding: 'utf8' })
  }));
}
