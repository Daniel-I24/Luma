import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { type UserScopedState, UserDataRegistry } from '@core/auth/user-data-registry';
import { ToastService } from '@design-system/toast/toast.service';
import { FavoriteRepository } from '@shared/business/data/favorite.repository';

/**
 * FavoritesStore — ids of the signed-in user's favourite businesses. Loaded
 * once per signed-in user and wiped on sign-out or account deletion, so no
 * one sees another user's favourites on a shared device. Toggling is
 * optimistic: the UI changes at once and is reverted if the request fails.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesStore implements UserScopedState {
  private readonly repo = inject(FavoriteRepository);
  private readonly toasts = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly userId = computed(() => this.auth.user()?.id ?? null);

  private readonly _ids = signal<ReadonlySet<string>>(new Set());
  private readonly _ready = signal(false);
  private readonly _failed = signal(false);
  private readonly pending = new Set<string>();
  private loadedFor: string | null = null;

  readonly ids = this._ids.asReadonly();
  /** True once the signed-in user's favourites were requested (loaded or failed). */
  readonly ready = this._ready.asReadonly();
  readonly failed = this._failed.asReadonly();

  constructor() {
    inject(UserDataRegistry).register(this);
    effect(() => {
      const userId = this.userId();
      untracked(() => void this.onUserChange(userId));
    });
  }

  clearUserData(): void {
    this.loadedFor = null;
    this.pending.clear();
    this._ids.set(new Set());
    this._ready.set(false);
    this._failed.set(false);
  }

  /** Requests the signed-in user's favourites again (e.g. after a failure). */
  async reload(): Promise<void> {
    const userId = this.loadedFor;
    this.loadedFor = null;
    await this.onUserChange(userId);
  }

  isFavorite(businessId: string): boolean {
    return this._ids().has(businessId);
  }

  /** Adds or removes a favourite; resolves to false when it had to be reverted. */
  async toggle(businessId: string): Promise<boolean> {
    if (this.pending.has(businessId)) return true;
    const wasFavorite = this.isFavorite(businessId);
    const owner = this.loadedFor;
    this.pending.add(businessId);
    this.setFavorite(businessId, !wasFavorite);
    try {
      const result = wasFavorite
        ? await this.repo.remove(businessId)
        : await this.repo.add(businessId);
      if (this.loadedFor !== owner) return false;
      if (result.errorKey) {
        this.setFavorite(businessId, wasFavorite);
        this.toasts.show({ messageKey: result.errorKey, tone: 'error' });
        return false;
      }
      this.toasts.show({
        messageKey: wasFavorite ? 'favorites.removed' : 'favorites.added',
        tone: 'success',
      });
      return true;
    } finally {
      this.pending.delete(businessId);
    }
  }

  private async onUserChange(userId: string | null): Promise<void> {
    if (userId === this.loadedFor) return;
    this.loadedFor = userId;
    this._ids.set(new Set());
    this._ready.set(false);
    this._failed.set(false);
    if (!userId) return;
    const result = await this.repo.getFavoriteIds();
    if (this.loadedFor !== userId) return;
    if (result.data) this._ids.set(new Set(result.data));
    this._failed.set(!result.data);
    this._ready.set(true);
  }

  private setFavorite(businessId: string, favorite: boolean): void {
    this._ids.update((ids) => {
      const next = new Set(ids);
      if (favorite) next.add(businessId);
      else next.delete(businessId);
      return next;
    });
  }
}
