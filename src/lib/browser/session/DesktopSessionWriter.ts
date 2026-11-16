import {
  DESKTOP_SESSION_STORAGE_KEY,
  isDesktopSession,
  type DesktopSession
} from './DesktopSession.js';

/** Per-desktop recovery writer. Coalesces changes in a 200 ms window; the owner must flush on page exit and dispose on removal. */
export class DesktopSessionWriter {
  private pending: DesktopSession | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private history: DesktopSession['editHistory'] | undefined;
  private historyJSON = '[]';
  private execution: DesktopSession['execution'] | undefined;
  private executionJSON = 'null';

  /** Acquire storage only when flushing. The callback receives a write failure, or undefined after success. */
  constructor(
    private readonly report: (error?: unknown) => void,
    private readonly storage: () => Pick<Storage, 'setItem'> = () => localStorage
  ) {}

  /** Queue the newest detached snapshot, which must remain unchanged after submission. History and execution identities also key the validation/serialization cache. */
  schedule(session: DesktopSession): void {
    if (this.disposed) return;
    this.pending = session;
    // Do not restart the timer: continuous typing/scrolling must not postpone the write indefinitely.
    this.timer ??= setTimeout(() => this.flush(), 200);
  }

  /** Attempt one atomic storage write of the latest snapshot, reusing validation and JSON for unchanged history/checkpoint identities. Report success or failure through the callback; a failed snapshot is not queued for retry. */
  flush = (): void => {
    clearTimeout(this.timer);
    this.timer = undefined;
    const session = this.pending;
    if (!session) return;
    this.pending = undefined;
    try {
      const { editHistory, execution, ...presentation } = session;
      const changedHistory = this.history !== editHistory;
      const changedExecution = this.execution !== execution;
      if (
        !isDesktopSession({
          ...presentation,
          editHistory: changedHistory ? editHistory : [],
          execution: changedExecution ? execution : null
        })
      )
        throw new TypeError('Invalid desktop recovery state');
      const historyJSON = changedHistory ? JSON.stringify(editHistory) : this.historyJSON;
      const executionJSON = changedExecution ? JSON.stringify(execution) : this.executionJSON;
      const header = JSON.stringify(presentation).slice(0, -1);
      this.storage().setItem(
        DESKTOP_SESSION_STORAGE_KEY,
        `${header},"editHistory":${historyJSON},"execution":${executionJSON}}`
      );
      this.history = editHistory;
      this.historyJSON = historyJSON;
      this.execution = execution;
      this.executionJSON = executionJSON;
      this.report();
    } catch (error) {
      this.report(error);
    }
  };

  /** Flush pending recovery once, cancel the timer, and release retained snapshots and encoded payloads. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.flush();
    this.history = undefined;
    this.execution = undefined;
    this.historyJSON = this.executionJSON = '';
  }
}
