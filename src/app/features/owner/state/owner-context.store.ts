import { Injectable, computed, inject, signal } from '@angular/core';
import { type UserScopedState, UserDataRegistry } from '@core/auth/user-data-registry';
import { MAX_OWNED_BUSINESSES } from '@shared/account/owner-paths';
import {
  OwnedBusinessRepository,
  type OwnedBusinessSummary,
} from '@shared/business/data/owned-business.repository';

/**
 * OwnerContextStore — the owner's businesses and the one Luma Negocios is
 * showing. In memory only (wiped on sign-out), so another user of the same
 * device never inherits the selection.
 */
@Injectable({ providedIn: 'root' })
export class OwnerContextStore implements UserScopedState {
  private readonly repo = inject(OwnedBusinessRepository);

  private readonly _businesses = signal<readonly OwnedBusinessSummary[] | null>(null);
  private readonly _selectedId = signal<string | null>(null);
  private readonly _errorKey = signal<string | null>(null);

  /** null until loaded. */
  readonly businesses = this._businesses.asReadonly();
  readonly selectedId = this._selectedId.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();
  readonly selected = computed(
    () => this._businesses()?.find((b) => b.id === this._selectedId()) ?? null,
  );
  readonly canAddMore = computed(() => (this._businesses()?.length ?? 0) < MAX_OWNED_BUSINESSES);

  constructor() {
    inject(UserDataRegistry).register(this);
  }

  /** Reads the owner's businesses; keeps the old list when the read fails. */
  async load(): Promise<readonly OwnedBusinessSummary[] | null> {
    const result = await this.repo.listMine();
    this._errorKey.set(result.errorKey);
    if (result.data) this._businesses.set(result.data);
    return this._businesses();
  }

  select(id: string): void {
    this._selectedId.set(id);
  }

  /** Where /owner lands: the last business shown when still owned, else the first. */
  landingId(): string | null {
    const list = this._businesses() ?? [];
    return list.find((b) => b.id === this._selectedId())?.id ?? list[0]?.id ?? null;
  }

  /** Keeps the list in step after a rename or a publish change. */
  patch(id: string, changes: Partial<OwnedBusinessSummary>): void {
    this._businesses.update(
      (list) => list?.map((b) => (b.id === id ? { ...b, ...changes } : b)) ?? null,
    );
  }

  clearUserData(): void {
    this._businesses.set(null);
    this._selectedId.set(null);
    this._errorKey.set(null);
  }
}
