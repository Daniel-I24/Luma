import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import {
  LumaBusinessCard,
  LumaButton,
  LumaEmptyState,
  LumaIconButton,
  LumaSkeleton,
} from '@design-system';
import { categoryIcon } from '@shared/business/utils/category-icon.util';
import { FavoriteButton } from '@shared/favorites/favorite-button/favorite-button';
import { FavoritesStore } from '@shared/favorites/favorites.store';
import { FavoritesPageStore } from './state/favorites-page.store';

/**
 * FavoritesPage — /favorites ("Mis favoritos", from the profile): cards of
 * the saved businesses; un-hearting one removes it at once.
 */
@Component({
  selector: 'app-favorites-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaBusinessCard,
    LumaButton,
    LumaEmptyState,
    LumaIconButton,
    LumaSkeleton,
    FavoriteButton,
  ],
  providers: [FavoritesPageStore],
  templateUrl: './favorites.page.html',
  host: { class: 'block' },
})
export class FavoritesPage {
  protected readonly store = inject(FavoritesPageStore);
  private readonly favorites = inject(FavoritesStore);
  private readonly router = inject(Router);
  protected readonly icon = categoryIcon;

  /** Loading until the favourite ids themselves are known. */
  protected readonly state = computed(() => (this.favorites.ready() ? this.store.state() : 'loading'));

  constructor() {
    effect(() => {
      if (this.favorites.ready()) untracked(() => void this.store.load());
    });
  }

  protected retry(): void {
    if (this.favorites.failed()) void this.favorites.reload();
    else void this.store.load();
  }

  protected open(id: string): void {
    void this.router.navigate(['/businesses', id]);
  }

  protected explore(): void {
    void this.router.navigate(['/map']);
  }

  protected back(): void {
    void this.router.navigate(['/profile']);
  }
}
