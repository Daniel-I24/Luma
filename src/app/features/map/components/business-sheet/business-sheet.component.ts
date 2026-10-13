import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaBottomSheet, LumaButton, StatusBadge } from '@design-system';
import type { Business, BusinessHours, Promotion } from '@features/businesses/models/business.model';
import { getBusinessStatus } from '@features/businesses/utils/business-status.util';

/**
 * BusinessSheetComponent — bottom sheet shown when a map marker is tapped.
 * Displays essential business info: name, status, hours, address, phone,
 * active promotion, and action buttons.
 */
@Component({
  selector: 'app-business-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaBottomSheet, LumaButton, StatusBadge],
  templateUrl: './business-sheet.component.html',
  styleUrl: './business-sheet.component.css',
})
export class BusinessSheetComponent {
  readonly business = input<Business | null>(null);
  readonly hours = input<BusinessHours[]>([]);
  readonly promotion = input<Promotion | null>(null);
  readonly distanceKm = input<number | null>(null);
  readonly open = input<boolean>(false);

  readonly closed = output<void>();
  readonly viewMenu = output<string>();
  readonly viewProfile = output<string>();

  protected readonly status = computed(() => {
    const b = this.business();
    if (!b) return 'closed' as const;
    return getBusinessStatus(this.hours());
  });

  protected readonly todayHours = computed(() => {
    const day = new Date().getDay() as BusinessHours['day_of_week'];
    return this.hours().find((h) => h.day_of_week === day) ?? null;
  });

  protected readonly formattedDistance = computed(() => {
    const d = this.distanceKm();
    return d !== null ? d.toFixed(1) : null;
  });

  protected onViewMenu(): void {
    const id = this.business()?.id;
    if (id) this.viewMenu.emit(id);
  }

  protected onViewProfile(): void {
    const id = this.business()?.id;
    if (id) this.viewProfile.emit(id);
  }
}
