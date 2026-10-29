/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/dump/AbstractDumpFormat.java. */
import type { Globals } from '../Globals.js';

/** Per-machine dump encoder. Callers own the returned bytes and all file I/O; no subscriptions or teardown. */
export abstract class AbstractDumpFormat {
  /** Bind this encoder to one machine, replacing Java's global memory and settings. */
  constructor(
    protected readonly machine: Globals,
    /** Legacy human-readable format name. */
    readonly name: string,
    /** Legacy command descriptor. */
    readonly descriptor: string,
    /** Legacy tooltip describing the encoding. */
    readonly description: string,
    /** Suggested browser extension; Java leaves all but Intel HEX unspecified. */
    readonly extension: string,
    /** MIME type for the browser save picker. */
    readonly mimeType = 'text/plain'
  ) {}

  /** Encode aligned inclusive word bounds, stopping at the first unallocated word; memory errors propagate. */
  abstract dumpMemoryRange(firstAddress: number, lastAddress: number): Uint8Array<ArrayBuffer>;

  /** Walk raw words silently in Java's signed address order. */
  protected *words(firstAddress: number, lastAddress: number): Generator<[number, number]> {
    for (
      let address = firstAddress | 0;
      address <= (lastAddress | 0);
      address = (address + 4) | 0
    ) {
      const word = this.machine.memory.getRawWordOrNull(address);
      if (word === null) break;
      yield [address, word];
    }
  }

  /** Java PrintStream text output with deterministic LF line endings and UTF-8 encoding. */
  protected text(lines: readonly string[]): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(lines.length ? lines.join('\n') + '\n' : '');
  }
}
