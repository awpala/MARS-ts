import { downloadBlob, requestSaveTarget, writeSaveTarget } from './download.js';
import { whenPageActive } from './pageFocus.js';

/** A mounted desktop's save/download workflow; dispose it when its owning component unmounts. */
export class FileDownload {
  private stopLatePromptGuard: (() => void) | undefined;
  private disposed = false;

  /** The desktop supplies its blocking-status capability; errors propagate to the caller. */
  constructor(private readonly beginTransfer: (status: string) => () => void) {}

  /** Save from the initiating user action; false means explicit picker cancellation, true means written or handed off. */
  async save(
    name: string,
    blob: Blob,
    description: string,
    status = 'Exporting…',
    cancelStatus = 'Canceling export…'
  ): Promise<boolean> {
    this.stopLatePromptGuard?.();
    let release = () => {};
    try {
      const picked = requestSaveTarget(name, blob, description);
      release = this.beginTransfer('Waiting for save location…');
      const target = await picked;
      const previous = release;
      release = this.beginTransfer(target === 'canceled' ? cancelStatus : status);
      previous();
      if (target === 'canceled') {
        await whenPageActive();
        return false;
      }
      if (target) await writeSaveTarget(target, blob);
      else {
        await downloadBlob(name, blob);
        if (!this.disposed) this.guardLatePrompt(status);
      }
      await whenPageActive();
      return true;
    } finally {
      release();
    }
  }

  private guardLatePrompt(status: string) {
    this.stopLatePromptGuard?.();
    const prompted = async () => {
      stop();
      const release = this.beginTransfer(status);
      const active = () => {
        release();
        this.stopLatePromptGuard = undefined;
      };
      const onFocus = () => {
        cleanup();
        void whenPageActive().then(active);
      };
      const cleanup = () => {
        window.removeEventListener('focus', onFocus);
      };
      this.stopLatePromptGuard = () => {
        cleanup();
        release();
      };
      window.addEventListener('focus', onFocus, { once: true });
    };
    const timer = setTimeout(() => stop(), 3000);
    const stop = () => {
      clearTimeout(timer);
      window.removeEventListener('blur', prompted);
      if (this.stopLatePromptGuard === stop) this.stopLatePromptGuard = undefined;
    };
    window.addEventListener('blur', prompted, { once: true });
    this.stopLatePromptGuard = stop;
  }

  /** Remove late-prompt listeners; an already requested save may settle but cannot install another guard. */
  dispose(): void {
    this.disposed = true;
    this.stopLatePromptGuard?.();
  }
}
