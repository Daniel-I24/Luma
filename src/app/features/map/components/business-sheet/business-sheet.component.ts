import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  LumaAvatar,
  LumaBottomSheet,
  LumaButton,
  LumaIcon,
  LumaIconButton,
  LumaRatingStars,
  StatusBadge,
} from '@design-system';
import type { BusinessHours, Promotion } from '@shared/business/models/business.model';
import { FavoriteButton } from '@shared/favorites/favorite-button/favorite-button';
import type { NearbyBusiness } from '../../state/nearby-businesses.store';
import { formatDistance, walkingMinutes } from '@shared/geo/distance.util';

/**
 * BusinessSheetComponent — bottom sheet shown when a business is chosen on
 * the map: logo, name, category, status, rating, distance and walking time,
 * active promotion, today's hours and actions.
 */
@Component({
  selector: 'app-business-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaAvatar,
    LumaBottomSheet,
    LumaButton,
    LumaIcon,
    LumaIconButton,
    LumaRatingStars,
    StatusBadge,
    FavoriteButton,
  ],
  templateUrl: './business-sheet.component.html',
})
export class BusinessSheetComponent {
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly item = input<NearbyBusiness | null>(null);
  readonly hours = input<BusinessHours[]>([]);
  readonly promotion = input<Promotion | null>(null);
  readonly open = input<boolean>(false);

  readonly closed = output<void>();

  /** Opens the full profile by URL (the profile is another feature). */
  protected viewRestaurant(businessId: string): void {
    void this.router.navigate(['/businesses', businessId]);
  }

  protected readonly todayHours = computed(() => {
    const day = new Date().getDay() as BusinessHours['day_of_week'];
    const today = this.hours().find((h) => h.day_of_week === day);
    return today && !today.is_closed
      ? { from: today.opens_at.slice(0, 5), to: today.closes_at.slice(0, 5) }
      : null;
  });

  protected readonly distance = computed(() => {
    const km = this.item()?.distanceKm ?? null;
    return km === null
      ? null
      : { distance: formatDistance(km, this.lang()), minutes: walkingMinutes(km) };
  });
}
