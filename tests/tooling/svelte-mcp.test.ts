import { readFileSync } from 'node:fs';
import { svelteAutofixer } from '@sveltejs/mcp';
import { VERSION } from 'svelte/compiler';
import { expect, it } from 'vitest';

function analyze(code: string, filename = 'State.svelte.ts') {
  return svelteAutofixer({ code, filename, desired_svelte_version: VERSION });
}

it.each(['private readonly', 'protected readonly', 'public readonly', 'readonly'])(
  'analyzes %s constructor parameter properties without crashing',
  async (modifier) => {
    const result = await analyze(`export class State {
  value = $state(0);
  constructor(${modifier} increment: number) {}
  advance() { this.value += this.increment; }
}`);
    expect(result.issues).toEqual([]);
  }
);

it('analyzes enums that require TypeScript transformation rather than type erasure', async () => {
  const result = await analyze(`enum Mode { Idle, Active }
export class State {
  mode = $state(Mode.Idle);
  constructor(private readonly next: Mode) {}
  activate() { this.mode = this.next; }
}`);
  expect(result.issues).toEqual([]);
});

it('preserves real compiler diagnostics and their original TypeScript source position', async () => {
  const result = await analyze(`export class State {
  constructor(private readonly start = 0) {}
  value = 0;
  update() {
    this.value = $state(this.start);
  }
}`);
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]).toContain('state_invalid_placement at line 5, column 17');
  expect(result.require_another_tool_call_after_fixing).toBe(true);
});

it('continues to analyze ordinary Svelte components', async () => {
  const result = await analyze(
    '<script lang="ts">let count = $state(0);</script>\n<button onclick={() => count++}>{count}</button>',
    'Counter.svelte'
  );
  expect(result.issues).toEqual([]);
});

it.each(['DesktopPersistence', 'DesktopState', 'SimulationState', 'SourceWorkspace'])(
  'analyzes the production %s module without an internal error',
  async (name) => {
    const filename = `${name}.svelte.ts`;
    // Pass source text, not an imported module: analysis must never instantiate desktop owners.
    const code = readFileSync(
      new URL(`../../src/lib/venus/state/${filename}`, import.meta.url),
      'utf8'
    );
    const result = await analyze(code, filename);
    // Effect advice is heuristic; a successful analysis can still include suggestions.
    expect(result.issues).toEqual([]);
  }
);
