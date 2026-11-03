import { Injectable, inject, signal } from '@angular/core';
import { type UserScopedState, UserDataRegistry } from '@core/auth/user-data-registry';

/** One read of Luma Negocios: what was asked and how many rows came back (never their content). */
export interface PanelQuery {
  readonly table: string;
  /** The filter applied, e.g. "owner_id = 1a2b3c4d…". Ids are cut to 8 characters. */
  readonly filter: string;
  /** Rows received; null when the read failed. */
  readonly rows: number | null;
  readonly at: string;
}

/** Enough to see the last visits to each screen. */
const MAX_ENTRIES = 30;
const SHORT_ID = 8;

/**
 * PanelQueryLog — the reads of the business panel, kept in memory for the
 * "Información técnica" panel of Mi negocio (to diagnose a wrong business
 * list). Only table, filter and row count; ids shortened; wiped at sign-out.
 */
@Injectable({ providedIn: 'root' })
export class PanelQueryLog implements UserScopedState {
  private readonly _entries = signal<readonly PanelQuery[]>([]);
  public readonly entries = this._entries.asReadonly();

  constructor() {
    inject(UserDataRegistry).register(this);
  }

  /** "owner_id = 1a2b3c4d…" from a column and a uuid. */
  public static filter(column: string, id: string | null | undefined): string {
    return `${column} = ${id ? `${id.slice(0, SHORT_ID)}…` : '(none)'}`;
  }

  /** Records one read; the newest first. */
  public record(table: string, filter: string, rows: number | null): void {
    const entry = { table, filter, rows, at: new Date().toISOString() };
    this._entries.update((list) => [entry, ...list].slice(0, MAX_ENTRIES));
  }

  /** Forgets every read (sign-out). */
  public clearUserData(): void {
    this._entries.set([]);
  }
}
