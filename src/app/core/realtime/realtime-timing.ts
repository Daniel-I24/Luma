import { MS_PER_SECOND } from '@core/config/units';
import type { RealtimeEvent, RealtimeTable } from './realtime.model';

/** What one screen listens to and how it refreshes. */
export interface RealtimeWatchOptions {
  readonly table: RealtimeTable;
  readonly onRefresh: (events: readonly RealtimeEvent[]) => unknown;
  readonly relevant: (event: RealtimeEvent) => boolean;
  readonly visible: () => boolean;
  /** Told once per outage (ErrorLog); the screen itself only sees `live` turn false. */
  readonly onError?: (error: unknown) => void;
}

/** Events within this window are refreshed once. */
export const REALTIME_BATCH_MS = 500;
/** Fallback polling while the channel is down (and only with the screen visible). */
export const REALTIME_POLL_MS = 30_000;
export const RECONNECT_BASE_MS = MS_PER_SECOND;
export const RECONNECT_MAX_MS = 30_000;
/** Each failed try doubles the wait. */
export const BACKOFF_FACTOR = 2;
export const FAILED_STATUSES = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);
/** "visibilitychange" and "resume" of the same return to the app count once. */
export const RETURN_GAP_MS = 2000;
