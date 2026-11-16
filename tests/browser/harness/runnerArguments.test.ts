import { expect, it } from 'vitest';
import { runnerArguments } from './runnerArguments.mjs';

it('never forwards file filters after project, boolean, or value-bearing options', () => {
  for (const prefix of [
    ['--project=workspace'],
    ['--project', 'workspace'],
    ['--project', 'workspace', 'settings'],
    ['--last-failed'],
    ['--headed'],
    ['--timeout=1000'],
    ['--timeout', '1000']
  ]) {
    const expected =
      prefix[0] === '--headed' ? ['--headed'] : prefix[0].startsWith('--timeout') ? prefix : [];
    expect(runnerArguments([...prefix, 'desktop.spec.ts', 'settings.spec.ts'])).toEqual(expected);
    expect(runnerArguments(['desktop.spec.ts', ...prefix, 'settings.spec.ts'])).toEqual(expected);
  }
});

it('preserves real option values, including regexes and optional modes', () => {
  const flags = [
    '-g',
    'one|two',
    '--reporter',
    'line',
    '--retries=2',
    '--debug',
    'cli',
    '-u',
    'missing',
    '--shuffle=42',
    '-j2'
  ];
  expect(runnerArguments(['a.spec.ts', ...flags, 'b.spec.ts'])).toEqual(flags);
  expect(runnerArguments(['a.spec.ts', '--headed', '--debug', '--shuffle', '-u'])).toEqual([
    '--headed',
    '--debug',
    '--shuffle',
    '-u'
  ]);
});
