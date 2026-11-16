import { applyMarsData, type MarsDataReading } from '#lib/browser/data/marsData.js';
import { errorMessage } from '#lib/browser/errorMessage.js';
import type { ModalState } from './ModalState.svelte.js';

/** Status that covers the desktop from a successful replacement until the page reloads. */
const RESTARTING = 'Restarting MARS…';

/** Cross-domain capabilities injected by the desktop; this owner holds no buffers, machine, or recovery writer. */
export type MarsDataImportHost = {
  /** Read whether simulation currently blocks replacing the application's data. */
  running: () => boolean;
  /** Stop the desktop's recovery writes so replaced storage survives page exit; the returned function resumes them. */
  suspendRecovery: () => () => void;
  /** Block interaction behind a status until the returned release runs. */
  beginTransfer: (status: string) => () => void;
  /** Reload the application so every owner restores from the replaced storage. */
  restart: () => void;
};

/** Per-desktop Import MARS workflow: the reading awaiting confirmation, and the replacement of this browser's stored data. */
export class MarsDataImport {
  /** Reading shown by the confirmation dialog: a conforming payload with its summary, or the reasons its file was rejected. */
  pending = $state.raw<MarsDataReading | null>(null);
  /** Failure of the last confirmed replacement; empty when none. */
  error = $state('');

  /** Compose with the shared modal state machine and explicit desktop capabilities. */
  constructor(
    private readonly modals: ModalState,
    private readonly host: MarsDataImportHost
  ) {}

  /** Stage a reading and show its confirmation or rejection; nothing is stored until confirmation. */
  accept = (reading: MarsDataReading): void => {
    this.error = '';
    this.pending = reading;
    this.modals.open({ kind: 'importMars' });
  };

  /** Close the dialog and release the staged reading without changing storage. */
  dismiss = (): void => {
    this.modals.close('importMars');
    this.pending = null;
    this.error = '';
  };

  /**
   * Replace this browser's stored application data with the staged payload, then restart. Recovery writes stop first so the
   * replaced records are not overwritten on page exit. A failed replacement restores the previous records, resumes recovery,
   * and stays in the dialog with its error.
   */
  confirm = (): void => {
    const data = this.pending?.data;
    if (!data) return;
    if (this.host.running()) {
      this.error = 'Stop execution before importing MARS data.';
      return;
    }
    const resume = this.host.suspendRecovery();
    try {
      applyMarsData(data, () => window.localStorage);
    } catch (error) {
      resume();
      this.error = `MARS data could not be imported: ${errorMessage(error)}. The previous data was restored.`;
      return;
    }
    this.host.beginTransfer(RESTARTING);
    this.host.restart();
  };
}
