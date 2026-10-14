import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { ToastService } from '@design-system/toast/toast.service';
import { FavoriteRepository } from '@shared/business/data/favorite.repository';

/**
 * FavoritesStore — ids of the signed-in user's favourite businesses. Loaded
 * once per signed-in user and cleared on sign-out. Toggling is optimistic:
 * the UI changes at once and is reverted if the request fails.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesStore {
  private readonly repo = inject(FavoriteRepository);
  private readonly toasts = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly userId = computed(() => this.auth.user()?.id ?? null);

  private readonly _ids = signal<ReadonlySet<string>>(new Set());
  private readonly pending = new Set<string>();
  private loadedFor: string | null = null;

  readonly ids = this._ids.asReadonly();

  constructor() {
    effect(() => {
      const userId = this.userId();
      untracked(() => void this.onUserChange(userId));
    });
  }

  isFavorite(businessId: string): boolean {
    return this._ids().has(businessId);
  }

  /** Adds or removes a favourite; resolves to false when it had to be reverted. */
  async toggle(businessId: string): Promise<boolean> {
    if (this.pending.has(businessId)) return true;
    const wasFavorite = this.isFavorite(businessId);
    this.pending.add(businessId);
    this.setFavorite(businessId, !wasFavorite);
    try {
      const result = wasFavorite
        ? await this.repo.remove(businessId)
        : await this.repo.add(businessId);
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
    if (!userId) return;
    const result = await this.repo.getFavoriteIds();
    if (this.loadedFor === userId && result.data) this._ids.set(new Set(result.data));
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
