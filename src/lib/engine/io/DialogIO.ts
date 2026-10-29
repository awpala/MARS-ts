/** Same-tab dialog presentation request; the browser owner retains focus, draft input, and cancellation. */
export type DialogRequest = {
  /** Canonical JOptionPane operation. */
  kind: 'confirm' | 'input' | 'message';
  /** Message assembled from MIPS memory and optional numeric/string suffix. */
  message: string;
  /** Java message type: -1 plain, 0 error, 1 information, 2 warning, 3 question. */
  messageType: number;
};
/** Host capabilities replacing JOptionPane; completion may suspend the current instruction. */
export interface DialogIOHost {
  /** Return Yes (0), No (1), Cancel (2), or window close (-1). */
  showConfirmDialog(message: string): number | Promise<number>;
  /** Return the entered UTF-16 string, including empty input, or null on cancellation. */
  showInputDialog(message: string): string | null | Promise<string | null>;
  /** Wait until the message is acknowledged or dismissed; no machine result is returned. */
  showMessageDialog(message: string, messageType: number): void | Promise<void>;
}
/** Session-owned dialog boundary; it retains only the host capability and owns no platform resources. */
export class DialogIO implements DialogIOHost {
  /** Bind the optional platform capability; attempting a dialog without one reports a host configuration error. */
  constructor(private readonly host?: DialogIOHost) {}
  /** Preserve the actual confirm result, including window close (-1). */
  showConfirmDialog(message: string): number | Promise<number> {
    return this.requireHost().showConfirmDialog(message);
  }
  /** Preserve null cancellation separately from an empty successful submission. */
  showInputDialog(message: string): string | null | Promise<string | null> {
    return this.requireHost().showInputDialog(message);
  }
  /** Preserve Java message type and wait for acknowledgment. */
  showMessageDialog(message: string, messageType: number): void | Promise<void> {
    return this.requireHost().showMessageDialog(message, messageType);
  }
  private requireHost(): DialogIOHost {
    if (!this.host) throw new Error('Dialog syscalls require a dialog host');
    return this.host;
  }
}
