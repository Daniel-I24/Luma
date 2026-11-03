/**
 * BusinessPause — "Pedidos en pausa": the owner stops new orders for a while
 * (businesses.orders_paused_until; 'infinity' means until resumed). The
 * server refuses orders while paused (business_paused); the app only shows it.
 */
export class BusinessPause {
  /** Minutes the owner can choose; -1 is "until I resume". */
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- data table: pause lengths in minutes (-1 until reopened)
  public static readonly OPTIONS = [15, 30, 60, 120, -1] as const;
  public static readonly UNTIL_RESUMED = -1;
  private static readonly INFINITY = 'infinity';

  public static isPaused(pausedUntil: string | null | undefined, now = Date.now()): boolean {
    if (!pausedUntil) return false;
    return pausedUntil === BusinessPause.INFINITY || Date.parse(pausedUntil) > now;
  }

  /** True when the pause has no end time. */
  public static isIndefinite(pausedUntil: string | null | undefined): boolean {
    return pausedUntil === BusinessPause.INFINITY;
  }
}
