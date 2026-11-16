/** Per-machine task scheduler: zero-delay yields use browser tasks; finite speeds retain their requested timer delay. */
export class CooperativeScheduler {
  private readonly channel = new MessageChannel();
  private readonly tasks = new Map<number, () => void>();
  private readonly timers = new Map<ReturnType<typeof setTimeout>, () => void>();
  private sequence = 0;
  private disposed = false;
  /** Own both message ports until disposal; queued task identities are never reused after a wake. */
  constructor() {
    this.channel.port1.onmessage = ({ data }: MessageEvent<number>) => {
      const resolve = this.tasks.get(data);
      this.tasks.delete(data);
      resolve?.();
    };
  }
  /** Suspend until a host task or the requested finite delay; disposed schedulers cannot retain a new wait. */
  yieldControl = (milliseconds: number): Promise<void> => {
    if (this.disposed) return Promise.resolve();
    return new Promise((resolve) => {
      if (milliseconds > 0) {
        const timer = setTimeout(() => {
          if (this.timers.delete(timer)) resolve();
        }, milliseconds);
        this.timers.set(timer, resolve);
      } else {
        const token = ++this.sequence;
        this.tasks.set(token, resolve);
        this.channel.port2.postMessage(token);
      }
    });
  };
  /** Release current waits on Pause or Stop; stale queued messages cannot release a later run's wait. */
  wake(): void {
    for (const [timer, resolve] of this.timers) {
      clearTimeout(timer);
      resolve();
    }
    this.timers.clear();
    for (const resolve of this.tasks.values()) resolve();
    this.tasks.clear();
  }
  /** Release waits and message ports synchronously when their owning desktop is removed. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.wake();
    this.channel.port1.onmessage = null;
    this.channel.port1.close();
    this.channel.port2.close();
  }
}
