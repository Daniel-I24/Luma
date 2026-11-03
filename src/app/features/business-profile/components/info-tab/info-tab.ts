import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { type IconName, LumaIcon } from '@design-system';
import type { Business, BusinessHours } from '@shared/business/models/business.model';
import { type ContactField, BusinessContacts } from '@shared/business/models/business-contact';
import { VerifiedContacts } from '@shared/business/verification/contact-verification';
import { RouteMap } from '@shared/route/route-map/route-map';
import { TrustCard } from '../trust-card/trust-card';
import { PhotoStrip } from '../photo-strip/photo-strip';
import { ReportSheet } from '../report-sheet/report-sheet';
import { MS_PER_DAY } from '@core/config/units';

/** "HH:MM" out of "HH:MM:SS". */
const HH_MM = 5;

const CONTACT_ICON: Record<ContactField, IconName> = {
  whatsapp: 'phone',
  instagram: 'image',
  facebook: 'user',
  website: 'globe',
};

/** Week starting on Monday, as is customary in Colombia (JS: 0 = Sunday). */
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- data table: Monday-first week
const WEEK: readonly BusinessHours['day_of_week'][] = [1, 2, 3, 4, 5, 6, 0];
/** 1 January 2024 was a Monday: offsets give each weekday's name. */
const A_MONDAY = new Date('2024-01-01T12:00:00');

export interface ScheduleRow {
  day: BusinessHours['day_of_week'];
  name: string;
  /** "08:30 – 19:00", or null when closed that day. */
  hours: string | null;
  isToday: boolean;
}

/** InfoTab — photos, weekly schedule (today highlighted), verified contacts with a badge, social links and address. */
@Component({
  selector: 'app-info-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIcon, PhotoStrip, ReportSheet, TrustCard, RouteMap],
  templateUrl: './info-tab.html',
  host: { class: 'block' },
})
export class InfoTab {
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  public readonly business = input.required<Business>();
  public readonly hours = input.required<readonly BusinessHours[]>();

  /** Only contacts the review team verified, and only well-formed values (wa.me, instagram.com, facebook.com, https). */
  protected readonly links = computed(() =>
    BusinessContacts.contactLinks(this.business())
      .filter((link) => VerifiedContacts.isVerified(this.business(), link.field))
      .map((link) => ({ ...link, icon: CONTACT_ICON[link.field] })),
  );
  /** The phone only once verified. */
  protected readonly phone = computed(() =>
    VerifiedContacts.isVerified(this.business(), 'phone') ? this.business().phone : null,
  );

  protected readonly rows = computed<ScheduleRow[]>(() => {
    const weekday = new Intl.DateTimeFormat(this.lang(), { weekday: 'long' });
    const today = new Date().getDay();
    return WEEK.map((day, offset) => {
      const entry = this.hours().find((h) => h.day_of_week === day);
      const open = entry && !entry.is_closed;
      const name = weekday.format(new Date(A_MONDAY.getTime() + offset * MS_PER_DAY));
      return {
        day,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        hours: open ? `${entry.opens_at.slice(0, HH_MM)} – ${entry.closes_at.slice(0, HH_MM)}` : null,
        isToday: day === today,
      };
    });
  });
}
