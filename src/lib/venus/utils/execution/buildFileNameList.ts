/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports buildFileNameList in mars/venus/RunAssembleAction.java. */

/** Format prepared source names in assembly order; the legacy 60-character counter excludes comma separators and wraps after the name. */
export function buildFileNameList(preamble: string, filenames: readonly string[]): string {
  let result = preamble;
  let lineLength = result.length;
  for (let index = 0; index < filenames.length; index++) {
    const filename = filenames[index];
    result += filename + (index < filenames.length - 1 ? ', ' : '');
    lineLength += filename.length;
    if (lineLength > 60) {
      result += '\n';
      lineLength = 0;
    }
  }
  return result + (lineLength === 0 ? '' : '\n') + '\n';
}
