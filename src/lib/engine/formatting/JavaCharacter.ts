/* MARS copyright Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Reproduces Java character and String.trim semantics consumed by MARS numeric and lexical operations.
 * Tables are generated from the pinned JDK 21 oracle, rather than the browser's Unicode version. */
import data from './character-data.json';

/** Java UTF-16 character categories and trimming used by numeric conversion and lexical analysis. */
export class JavaCharacter {
  /** Remove leading and trailing UTF-16 code units <= U+0020, as Java String.trim does. */
  static trim(value: string): string {
    let start = 0;
    let end = value.length;
    while (start < end && value.charCodeAt(start) <= 32) start++;
    while (end > start && value.charCodeAt(end - 1) <= 32) end--;
    return value.slice(start, end);
  }
  /** Whether the first UTF-16 code unit has a Java letter category; surrogates are not letters. */
  static isLetter(character: string): boolean {
    return this.rangeStart(character, data.letterRanges) >= 0;
  }
  /** Whether the first UTF-16 code unit is a Java decimal digit. */
  static isDigit(character: string): boolean {
    return this.rangeStart(character, data.digitRanges) >= 0;
  }
  /** Whether the first UTF-16 code unit is a Java letter or decimal digit. */
  static isLetterOrDigit(character: string): boolean {
    return this.isLetter(character) || this.isDigit(character);
  }
  /** Return a Java decimal digit's numeric value, or -1 for a non-digit code unit. */
  static decimalDigitValue(character: string): number {
    const start = this.rangeStart(character, data.digitRanges);
    return start < 0 ? -1 : (character.charCodeAt(0) - start) % 10;
  }
  private static rangeStart(character: string, ranges: readonly (readonly number[])[]): number {
    if (character.length === 0) return -1;
    const code = character.charCodeAt(0);
    let low = 0;
    let high = ranges.length - 1;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      const [start, end] = ranges[middle];
      if (code < start) high = middle - 1;
      else if (code > end) low = middle + 1;
      else return start;
    }
    return -1;
  }
}
