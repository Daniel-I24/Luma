import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { type UserScopedState, UserDataRegistry } from '@core/auth/session-end';
import { MAX_OWNED_BUSINESSES } from '@shared/account/account-paths';
import { OwnedBusinessRepository, type OwnedBusinessSummary } from '@shared/business/data/owned-business.repository';

/**
 * OwnerContextStore — the owner's businesses and the one Luma Negocios is
 * showing. In memory only (wiped on sign-out), so another user of the same
 * device never inherits the selection.
 */
@Injectable({ providedIn: 'root' })
export class OwnerContextStore implements UserScopedState {
  private readonly repo = inject(OwnedBusinessRepository);
  private readonly auth = inject(AuthService);
  /** Whose list is held: another account signing in on this device never sees it. */
  private loadedFor: string | null = null;

  private readonly _businesses = signal<readonly OwnedBusinessSummary[] | null>(null);
  private readonly _selectedId = signal<string | null>(null);
  private readonly _errorKey = signal<string | null>(null);

  /** null until loaded. */
  public readonly businesses = this._businesses.asReadonly();
  public readonly selectedId = this._selectedId.asReadonly();
  public readonly errorKey = this._errorKey.asReadonly();
  public readonly selected = computed(
    () => this._businesses()?.find((b) => b.id === this._selectedId()) ?? null,
  );
  public readonly max = MAX_OWNED_BUSINESSES;
  public readonly count = computed(() => this._businesses()?.length ?? 0);
  public readonly canAddMore = computed(() => this.count() < MAX_OWNED_BUSINESSES);

  constructor() {
    inject(UserDataRegistry).register(this);
  }

  /** Reads the owner's businesses; keeps the old list when the read fails. */
  public async load(): Promise<readonly OwnedBusinessSummary[] | null> {
    const userId = this.auth.user()?.id ?? null;
    if (this.loadedFor !== null && userId !== this.loadedFor) this.clearUserData();
    this.loadedFor = userId;
    const result = await this.repo.listMine();
    this._errorKey.set(result.errorKey);
    if (result.data) this._businesses.set(result.data);
    return this._businesses();
  }

  /** Selects the business the owner works on. */
  public select(id: string): void {
    this._selectedId.set(id);
  }

  /** Where /owner lands: the last business shown when still owned, else the first. */
  public landingId(): string | null {
    const list = this._businesses() ?? [];
    return list.find((b) => b.id === this._selectedId())?.id ?? list[0]?.id ?? null;
  }

  /** Keeps the list in step after a rename or a publish change. */
  public patch(id: string, changes: Partial<OwnedBusinessSummary>): void {
    this._businesses.update(
      (list) => list?.map((b) => (b.id === id ? { ...b, ...changes } : b)) ?? null,
    );
  }

  /** True when the list held belongs to another account than the signed-in one. */
  public isStale(): boolean {
    return this._businesses() !== null && this.loadedFor !== (this.auth.user()?.id ?? null);
  }

  /** Forgets the owner's businesses (sign-out). */
  public clearUserData(): void {
    this.loadedFor = null;
    this._businesses.set(null);
    this._selectedId.set(null);
    this._errorKey.set(null);
  }
}
