/** The specified java.util.Random 48-bit generator used by MARS; each stream owns its seed and no host resources. */
export class JavaRandom {
  private seed = 0n;
  /** Initialize with Java's signed-long seed scrambling. */
  constructor(seed: bigint) {
    this.setSeed(seed);
  }
  /** Restart this stream using the low 48 bits of the scrambled seed. */
  setSeed(seed: bigint): void {
    this.seed = (seed ^ 0x5deece66dn) & ((1n << 48n) - 1n);
  }
  /** Return a signed int, or Java's rejection-sampled value below a positive signed-int bound. */
  nextInt(bound?: number): number {
    if (bound === undefined) return this.next(32) | 0;
    if (bound <= 0) throw new RangeError('bound must be positive');
    if ((bound & -bound) === bound) return Number((BigInt(bound) * BigInt(this.next(31))) >> 31n);
    let bits: number, value: number;
    do {
      bits = this.next(31);
      value = bits % bound;
    } while (((bits - value + (bound - 1)) | 0) < 0);
    return value;
  }
  /** Return the next exactly representable single-precision value in [0, 1). */
  nextFloat(): number {
    return this.next(24) / 2 ** 24;
  }
  /** Return the next double using Java's successive 26-bit and 27-bit draws. */
  nextDouble(): number {
    return (this.next(26) * 2 ** 27 + this.next(27)) / 2 ** 53;
  }
  /** Capture the exact internal 48-bit seed as a JSON-safe integer. */
  captureState(): number {
    return Number(this.seed);
  }
  /** Restore an already validated internal seed without scrambling it again. */
  restoreState(seed: number): void {
    this.seed = BigInt(seed);
  }
  private next(bits: number): number {
    this.seed = (this.seed * 0x5deece66dn + 0xbn) & ((1n << 48n) - 1n);
    return Number(this.seed >> BigInt(48 - bits));
  }
}
