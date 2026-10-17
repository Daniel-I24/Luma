import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaAvatar, LumaIcon, LumaIconButton, LumaImage, StatusBadge } from '@design-system';
import type { Business, BusinessStatus } from '@shared/business/models/business.model';
import { categoryIcon } from '@shared/business/utils/category-icon.util';
import { FavoriteButton } from '@shared/favorites/favorite-button/favorite-button';
import { DistancePipe } from '@shared/geo/distance.pipe';

/**
 * ProfileHero — top of the business profile: cover (or a token background
 * with the category icon), back and favourite buttons, logo, name,
 * category, status and distance.
 */
@Component({
  selector: 'app-profile-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaAvatar,
    LumaIcon,
    LumaImage,
    LumaIconButton,
    StatusBadge,
    FavoriteButton,
    DistancePipe,
  ],
  templateUrl: './profile-hero.html',
  host: { class: 'block' },
})
export class ProfileHero {
  private readonly transloco = inject(TranslocoService);
  protected readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly business = input.required<Business>();
  readonly status = input.required<BusinessStatus>();
  readonly distanceKm = input<number | null>(null);

  readonly back = output<void>();

  protected readonly icon = computed(() => categoryIcon(this.business().category));
}
