import { Injectable } from '@angular/core';

const SEEN_KEY = 'luma-entry-seen';
/** Longest entry the first time the app opens on this device. */
export const FIRST_ENTRY_MS = 1800;
/** Longest entry from the second cold start on. */
export const REPEAT_ENTRY_MS = 900;

/**
 * EntryPolicy — how long the app entry may last: 1.8 s the first time, 0.9 s
 * afterwards (remembered in localStorage; without storage every start counts
 * as a repeat, the shorter option).
 */
@Injectable({ providedIn: 'root' })
export class EntryPolicy {
  /** The cap for this cold start; marks the entry as seen. */
  public maxDurationMs(): number {
    try {
      if (localStorage.getItem(SEEN_KEY)) return REPEAT_ENTRY_MS;
      localStorage.setItem(SEEN_KEY, '1');
      return FIRST_ENTRY_MS;
    } catch {
      // Storage unavailable (private mode): prefer the shorter entry.
      return REPEAT_ENTRY_MS;
    }
  }
}
