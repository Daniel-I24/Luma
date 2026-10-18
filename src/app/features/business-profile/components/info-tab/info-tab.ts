import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaIcon } from '@design-system';
import type { Business, BusinessHours } from '@shared/business/models/business.model';
import { ReportSheet } from '../report-sheet/report-sheet';

/** Week starting on Monday, as is customary in Colombia (JS: 0 = Sunday). */
const WEEK: readonly BusinessHours['day_of_week'][] = [1, 2, 3, 4, 5, 6, 0];
/** 1 January 2024 was a Monday: offsets give each weekday's name. */
const A_MONDAY = new Date(2024, 0, 1);

export interface ScheduleRow {
  day: BusinessHours['day_of_week'];
  name: string;
  /** "08:30 – 19:00", or null when closed that day. */
  hours: string | null;
  isToday: boolean;
}

/** InfoTab — weekly schedule (today highlighted), phone and address. */
@Component({
  selector: 'app-info-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIcon, ReportSheet],
  templateUrl: './info-tab.html',
  host: { class: 'block' },
})
export class InfoTab {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly business = input.required<Business>();
  readonly hours = input.required<readonly BusinessHours[]>();

  protected readonly rows = computed<ScheduleRow[]>(() => {
    const weekday = new Intl.DateTimeFormat(this.lang(), { weekday: 'long' });
    const today = new Date().getDay();
    return WEEK.map((day, offset) => {
      const entry = this.hours().find((h) => h.day_of_week === day);
      const open = entry && !entry.is_closed;
      const name = weekday.format(new Date(A_MONDAY.getTime() + offset * 86_400_000));
      return {
        day,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        hours: open ? `${entry.opens_at.slice(0, 5)} – ${entry.closes_at.slice(0, 5)}` : null,
        isToday: day === today,
      };
    });
  });
}
