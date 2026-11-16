import { expect, it } from 'vitest';
import { ModalState } from '#lib/venus/state/ModalState.svelte.js';
import { helpBrowserArticle } from '#lib/help/articles.js';

it('selects exactly one primary workflow and ignores another kind of close', () => {
  const modals = new ModalState();
  expect(modals.isOpen).toBe(false);
  modals.open({ kind: 'workspace', name: 'open' });
  modals.open({ kind: 'workspace', name: 'delete' });
  expect(modals.layers).toEqual([{ kind: 'workspace', name: 'delete' }]);
  modals.open({ kind: 'help', article: helpBrowserArticle });
  modals.close('workspace');
  expect(modals.layers).toEqual([{ kind: 'help', article: helpBrowserArticle }]);
  expect(modals.isOpen).toBe(true);
  modals.close('help');
  expect(modals.isOpen).toBe(false);
});

it('retains the primary dialog through transfer and input overlays and ignores superseded releases', () => {
  const modals = new ModalState();
  modals.open({ kind: 'dump' });
  const draft = modals.primary;
  const oldTransfer = modals.begin({ kind: 'transfer', status: 'Waiting' });
  const input = modals.begin({ kind: 'syscall' });
  const transfer = modals.begin({ kind: 'transfer', status: 'Writing' });
  oldTransfer();
  expect(modals.primary).toBe(draft);
  expect(modals.layers).toEqual([
    draft,
    { kind: 'transfer', status: 'Writing' },
    { kind: 'syscall' }
  ]);
  input();
  transfer();
  transfer();
  expect(modals.layers).toEqual([draft]);
  modals.close('dump');
  expect(modals.isOpen).toBe(false);
});

it('disposal seals the state machine against late async completion and new requests', () => {
  const modals = new ModalState();
  const release = modals.begin({ kind: 'runInput' });
  modals.dispose();
  release();
  modals.open({ kind: 'exceptionHandler' });
  modals.begin({ kind: 'transfer', status: 'Late' })();
  modals.dispose();
  expect(modals.layers).toEqual([]);
  expect(modals.primary).toBeNull();
  expect(modals.isOpen).toBe(false);
});
