import { RETURN_GAP_MS } from './realtime-timing';

/** One full re-read at a time, and one per return to the app. */
export class RefreshGate {
  private running: Promise<void> | null = null;
  private returnedAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly read: () => Promise<void>) {}

  /** A call while one is running shares it: the screen reads once. */
  public now(): Promise<void> {
    this.running ??= this.read().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** False for the second event of the same return ("visibilitychange" and "resume"). */
  public isNewReturn(): boolean {
    const at = Date.now();
    if (at - this.returnedAt < RETURN_GAP_MS) return false;
    this.returnedAt = at;
    return true;
  }
}

/** Calls `tick` at a fixed pace until stopped; starting twice keeps one timer. */
export class Poller {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly everyMs: number, private readonly tick: () => void) {}

  /** Starts the timer; already running, nothing changes. */
  public start(): void {
    this.timer ??= setInterval(this.tick, this.everyMs);
  }

  /** Stops the timer. */
  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
