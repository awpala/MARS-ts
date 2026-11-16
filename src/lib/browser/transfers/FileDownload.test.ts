import { afterEach, expect, it, vi } from 'vitest';
import { FileDownload } from './FileDownload.js';
import { whenPageActive } from './pageFocus.js';

vi.mock('./download.js', () => ({
  requestSaveTarget: vi.fn().mockResolvedValue(null),
  downloadBlob: vi.fn().mockResolvedValue(undefined),
  writeSaveTarget: vi.fn()
}));
vi.mock('./pageFocus.js', () => ({ whenPageActive: vi.fn().mockResolvedValue(undefined) }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('a superseded focus continuation cannot clear the replacement download guard', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('window', new EventTarget());
  const releases: ReturnType<typeof vi.fn>[] = [];
  const begin = vi.fn(() => {
    const release = vi.fn();
    releases.push(release);
    return release;
  });
  const download = new FileDownload(begin);
  const blob = new Blob(['source']);
  await download.save('first.asm', blob, 'Assembly');
  window.dispatchEvent(new Event('blur'));
  const oldRelease = releases.at(-1)!;
  let regainFocus!: () => void;
  vi.mocked(whenPageActive).mockReturnValueOnce(
    new Promise((resolve) => {
      regainFocus = resolve;
    })
  );
  window.dispatchEvent(new Event('focus'));
  await download.save('second.asm', blob, 'Assembly');
  expect(oldRelease).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(1);
  regainFocus();
  await Promise.resolve();
  expect(oldRelease).toHaveBeenCalledOnce();
  download.dispose();
  expect(vi.getTimerCount()).toBe(0);
  const transfers = begin.mock.calls.length;
  window.dispatchEvent(new Event('blur'));
  expect(begin).toHaveBeenCalledTimes(transfers);
});
