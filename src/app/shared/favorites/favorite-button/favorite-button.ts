import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIconButton } from '@design-system';
import type { IconButtonVariant } from '@design-system';
import { FavoritesStore } from '../favorites.store';

/** FavoriteButton — heart toggle for one business, backed by FavoritesStore. */
@Component({
  selector: 'app-favorite-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIconButton],
  templateUrl: './favorite-button.html',
  host: { class: 'inline-flex' },
})
export class FavoriteButton {
  private readonly favorites = inject(FavoritesStore);

  readonly businessId = input.required<string>();
  readonly variant = input<IconButtonVariant>('ghost');

  protected readonly isFavorite = computed(() => this.favorites.ids().has(this.businessId()));

  protected toggle(): void {
    void this.favorites.toggle(this.businessId());
  }
}
