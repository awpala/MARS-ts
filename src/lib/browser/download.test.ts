import { describe, expect, it } from 'vitest';
import { writeSaveTarget, type SaveTarget } from './download.js';

/** A save target whose stream records each call and optionally fails one step. */
function target(fail?: 'write' | 'close') {
  const calls: string[] = [];
  const failure = new Error(`${fail} failed`);
  const saveTarget: SaveTarget = {
    createWritable: async () => ({
      write: async () => {
        calls.push('write');
        if (fail === 'write') throw failure;
      },
      close: async () => {
        calls.push('close');
        if (fail === 'close') throw failure;
      },
      abort: async (reason) => {
        calls.push(reason === failure ? 'abort:failure' : 'abort');
      }
    })
  };
  return { saveTarget, calls, failure };
}

describe('writeSaveTarget', () => {
  it('closes the stream after writing', async () => {
    const { saveTarget, calls } = target();
    await writeSaveTarget(saveTarget, new Blob(['source']));
    expect(calls).toEqual(['write', 'close']);
  });

  it('aborts the stream and rethrows when writing or closing fails', async () => {
    for (const step of ['write', 'close'] as const) {
      const { saveTarget, calls, failure } = target(step);
      await expect(writeSaveTarget(saveTarget, new Blob(['source']))).rejects.toBe(failure);
      expect(calls).toEqual(
        step === 'write' ? ['write', 'abort:failure'] : ['write', 'close', 'abort:failure']
      );
    }
  });

  it('reports the write failure even when aborting also fails', async () => {
    const { saveTarget, failure } = target('write');
    const failingAbort: SaveTarget = {
      createWritable: async () => ({
        ...(await saveTarget.createWritable()),
        abort: async () => {
          throw new Error('abort failed');
        }
      })
    };
    await expect(writeSaveTarget(failingAbort, new Blob(['source']))).rejects.toBe(failure);
  });
});
