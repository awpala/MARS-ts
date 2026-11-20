/* Adapted from mars/venus/MessagesPane.java. Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license. */
/** Read an ErrorList location at the start of a console line, including nested macro line histories. */
export function messageLocation(text: string) {
  const match = /^(Error|Warning) in (.+?) line ((?:\d+->)*)(\d+)(?: column (\d+))?: /.exec(text);
  if (!match) return null;
  return {
    filename: match[2],
    line: Number(match[4]),
    column: Number(match[5] ?? 0),
    warning: match[1] === 'Warning'
  };
}
