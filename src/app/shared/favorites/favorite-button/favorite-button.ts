import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIconButton } from '@design-system';
import type { IconButtonVariant } from '@design-system';
import { FavoritesStore } from '../favorites.store';

type Feedback = 'pop' | 'shake';

/**
 * FavoriteButton — heart toggle for one business, backed by FavoritesStore.
 * The heart pops when marked and shakes if the change had to be reverted.
 */
@Component({
  selector: 'app-favorite-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIconButton],
  templateUrl: './favorite-button.html',
  host: {
    class: 'inline-flex',
    '[class.motion-pop]': "feedback() === 'pop'",
    '[class.motion-shake]': "feedback() === 'shake'",
    '(animationend)': 'feedback.set(null)',
  },
})
export class FavoriteButton {
  private readonly favorites = inject(FavoritesStore);

  readonly businessId = input.required<string>();
  readonly variant = input<IconButtonVariant>('ghost');

  protected readonly isFavorite = computed(() => this.favorites.ids().has(this.businessId()));
  protected readonly feedback = signal<Feedback | null>(null);

  protected async toggle(): Promise<void> {
    this.feedback.set(this.isFavorite() ? null : 'pop');
    const saved = await this.favorites.toggle(this.businessId());
    if (!saved) this.feedback.set('shake');
  }
}
