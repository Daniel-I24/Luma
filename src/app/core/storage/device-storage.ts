import { Injectable } from '@angular/core';

/** Every key this app writes on the device starts with this. */
const PREFIX = 'luma.';

/**
 * DeviceStorage — small values remembered on this device (localStorage):
 * tutorials seen, form drafts. Storage can be missing or full (private
 * windows, blocked site data): reads then return null and writes false, so
 * nothing that depends on it ever breaks a screen.
 */
@Injectable({ providedIn: 'root' })
export class DeviceStorage {
  /** The stored value, or null when missing or unreadable. */
  public read(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(PREFIX + key) ?? null;
    } catch {
      return null;
    }
  }

  /** Stores a value; false when the device refused it. */
  public write(key: string, value: string): boolean {
    try {
      globalThis.localStorage?.setItem(PREFIX + key, value);
      return !!globalThis.localStorage;
    } catch {
      return false;
    }
  }

  /** Forgets a value (no-op when storage is unavailable). */
  public remove(key: string): void {
    try {
      globalThis.localStorage?.removeItem(PREFIX + key);
    } catch {
      // Nothing stored, nothing to forget.
    }
  }

  /** Every stored key (without the prefix) that starts with `start`. */
  public keys(start: string): string[] {
    try {
      const storage = globalThis.localStorage;
      if (!storage) return [];
      const found: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith(PREFIX + start)) found.push(key.slice(PREFIX.length));
      }
      return found;
    } catch {
      return [];
    }
  }
}
