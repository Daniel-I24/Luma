import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaInput, ToastService } from '@design-system';
import { BusinessHoursWriteRepository } from '@shared/business/data/business-hours-write.repository';
import { dayHoursSchema } from '@shared/business/data/business-write.schemas';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { FormErrors } from '@shared/forms/form-errors';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { RouteBusinessId } from '../../utils/route-business-id';
import { type DayDraft, WeekDrafts } from '../../utils/week-draft';
import { SetupReturn } from '../../components/setup-return/setup-return';
import { ZodRules } from '@core/validation/zod-rules';

/** BusinessHoursPage — /owner/:id/business/hours: 7 days, open or closed, one row per day. */
@Component({
  selector: 'app-business-hours-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SetupReturn,TranslocoModule, LumaButton, LumaInput, PanelHeader, PanelStateView],
  providers: [PanelBusinessStore],
  templateUrl: './business-hours.page.html',
  host: { class: 'block' },
})
export class BusinessHoursPage {
  protected readonly panel = inject(PanelBusinessStore);
  private readonly businesses = inject(BusinessRepository);
  private readonly hoursRepo = inject(BusinessHoursWriteRepository);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  protected readonly id = RouteBusinessId.routeBusinessId((id) => this.load(id));

  protected readonly week = signal<DayDraft[]>(WeekDrafts.weekDraft([]));
  /** Error key per day of the week. */
  protected readonly errors = signal<Readonly<Record<number, string>>>({});
  protected readonly errorKey = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly crossesMidnight = WeekDrafts.crossesMidnight;

  protected async load(id = this.id()): Promise<void> {
    const [, hours] = await Promise.all([this.panel.load(id), this.businesses.getHours(id)]);
    this.week.set(WeekDrafts.weekDraft(hours.data ?? []));
    this.errorKey.set(hours.errorKey);
  }

  protected update(day: number, changes: Partial<DayDraft>): void {
    this.week.update((week) => week.map((d) => (d.day_of_week === day ? { ...d, ...changes } : d)));
    this.errors.update((errors) =>
      Object.fromEntries(Object.entries(errors).filter(([edited]) => Number(edited) !== day)),
    );
  }

  protected onOpenChange(day: number, event: Event): void {
    this.update(day, { is_closed: !(event.target as HTMLInputElement).checked });
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    const errors: Record<number, string> = {};
    for (const day of this.week()) {
      const parsed = dayHoursSchema.safeParse(day);
      if (!parsed.success) errors[day.day_of_week] = ZodRules.firstMessage(parsed.error);
    }
    this.errors.set(errors);
    if (Object.keys(errors).length) {
      this.errorKey.set('businessPanel.form.fixErrors');
      const order = this.week().map(
        (d) => [String(d.day_of_week), `hours-${d.day_of_week}-closes`] as const,
      );
      FormErrors.focusFirstError(this.document, order, errors);
      return;
    }
    this.errorKey.set(null);
    this.saving.set(true);
    const result = await this.hoursRepo.saveWeek(this.id(), this.week());
    this.saving.set(false);
    if (result.errorKey) {
      this.errorKey.set(result.errorKey);
      return;
    }
    this.toast.show({ messageKey: 'businessPanel.form.saved', tone: 'success' });
  }
}
