import type { HelpArticle } from '#lib/help/articles.js';

/** Source workflows whose drafts, queues, and cancellation rules remain owned by SourceWorkspace. */
export type WorkspaceDialog =
  'open' | 'delete' | 'import' | 'save' | 'close' | 'close-all' | 'find' | 'rename-warning';

/** Mutually exclusive desktop dialog; its domain owner retains all mutable workflow data. */
export type PrimaryModal =
  | {
      /** Source workflow being presented. */
      kind: 'workspace';
      /** Current workflow step. */
      name: WorkspaceDialog;
    }
  | {
      /** Selected Help presentation. */
      kind: 'help';
      /** Immutable bundled article metadata. */
      article: HelpArticle;
    }
  | {
      /** Settings, dump, breakpoint confirmation, or MARS data import confirmation presentation. */
      kind: 'memoryConfiguration' | 'exceptionHandler' | 'dump' | 'clearBreakpoints' | 'importMars';
    };

/** Temporary interaction owner layered above a primary dialog without discarding that dialog's draft. */
export type BlockingModal =
  | {
      /** Pending file transfer. */
      kind: 'transfer';
      /** Current progress caption. */
      status: string;
    }
  | {
      /** Simulation-owned request; the resolver and draft stay in SimulationState. */
      kind: 'runInput' | 'syscall';
    };

/** Every dialog rendered by the desktop; the registry must cover every variant. */
export type DesktopModal = PrimaryModal | BlockingModal;

function owner(modal: DesktopModal): 'primary' | 'transfer' | 'input' {
  switch (modal.kind) {
    case 'transfer':
      return 'transfer';
    case 'runInput':
    case 'syscall':
      return 'input';
    default:
      return 'primary';
  }
}

/** Per-desktop modal state machine: one primary workflow, temporary transfer/input overlays, and identity-guarded completion. */
export class ModalState {
  // Transitions use live, nonreactive identity even during Svelte teardown's historical state reads.
  private current: readonly DesktopModal[] = [];
  private snapshot = $state.raw<readonly DesktopModal[]>([]);
  private disposed = false;

  /** Primary workflow followed by blocking overlays in owner-opening order. Replacing an overlay preserves its position; overlays leave underlying draft components mounted. */
  get layers(): readonly DesktopModal[] {
    return this.snapshot;
  }
  /** Selected primary workflow, including while a transfer or syscall owns interaction. */
  get primary(): PrimaryModal | null {
    return (
      (this.snapshot.find((modal) => owner(modal) === 'primary') as PrimaryModal | undefined) ??
      null
    );
  }
  /** Whether any modal layer blocks ordinary desktop commands. */
  get isOpen(): boolean {
    return this.snapshot.length > 0;
  }

  /** Select one primary workflow, replacing its predecessor while preserving temporary overlays. */
  open(modal: PrimaryModal): void {
    if (this.disposed) return;
    this.publish([
      Object.freeze({ ...modal }),
      ...this.current.filter((entry) => owner(entry) !== 'primary')
    ]);
  }
  /** Close only the named primary workflow; a stale close cannot dismiss another kind of dialog. */
  close(kind: PrimaryModal['kind']): void {
    if (this.disposed) return;
    this.publish(this.current.filter((entry) => entry.kind !== kind));
  }
  /** Begin or replace one owner's blocking overlay. Its release removes only this request, revealing retained layers. */
  begin(modal: BlockingModal): () => void {
    if (this.disposed) return () => {};
    const request = Object.freeze({ ...modal });
    const index = this.current.findIndex((entry) => owner(entry) === owner(request));
    const layers = [...this.current];
    if (index < 0) layers.push(request);
    else layers[index] = request;
    this.publish(layers);
    return () => {
      if (!this.disposed && this.current.includes(request))
        this.publish(this.current.filter((entry) => entry !== request));
    };
  }
  /** Seal the removed desktop; late asynchronous releases or open requests cannot revive it. */
  dispose(): void {
    this.disposed = true;
    this.publish([]);
  }
  private publish(layers: readonly DesktopModal[]): void {
    this.current = layers;
    this.snapshot = layers;
  }
}
