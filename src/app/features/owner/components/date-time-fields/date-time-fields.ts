import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaSelect, type SelectOption } from '@design-system';
import { TimeOptions } from '../../utils/time-options';

/** Days offered ahead of today. */
const DAYS_AHEAD = 120;
const DAY_MS = 86_400_000;
const PAD = 2;
const DAY_PART = 10;
const DEFAULT_TIME = '08:00';

/** "YYYY-MM-DD" of a local date. */
const isoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(PAD, '0')}-${String(date.getDate()).padStart(PAD, '0')}`;

/**
 * DateTimeFields — a day and a time picked from the app's own sheets (no
 * system calendar or clock), bound as "YYYY-MM-DDTHH:MM" like the
 * datetime-local field it replaces. The day field carries `fieldId`, so a
 * form can focus it on an error.
 */
@Component({
  selector: 'app-date-time-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaSelect],
  template: `
    <fieldset *transloco="let t" class="m-0 flex flex-col gap-1 border-0 p-0">
      <legend class="mb-1 p-0 text-label-lg text-fg">{{ label() }}@if (required()) {<span class="text-danger-fg" aria-hidden="true"> *</span>}</legend>
      <div class="grid grid-cols-[3fr_2fr] gap-3">
        <app-luma-select
          [selectId]="fieldId()"
          [label]="t('dateTime.day')"
          [placeholder]="t('dateTime.chooseDay')"
          [required]="required()"
          [options]="days()"
          [errorMessage]="errorMessage()"
          [value]="day()"
          (valueChange)="setDay($event)"
        />
        <app-luma-select
          [selectId]="fieldId() + '-time'"
          [label]="t('dateTime.time')"
          [placeholder]="t('dateTime.chooseTime')"
          [required]="required()"
          [options]="times()"
          [value]="time()"
          (valueChange)="setTime($event)"
        />
      </div>
    </fieldset>
  `,
})
export class DateTimeFields {
  private readonly transloco = inject(TranslocoService);

  public readonly fieldId = input.required<string>();
  public readonly label = input.required<string>();
  public readonly required = input(false);
  public readonly errorMessage = input<string | undefined>(undefined);
  /** "YYYY-MM-DDTHH:MM", or '' while nothing is chosen. */
  public readonly value = model('');

  protected readonly day = computed(() => this.value().slice(0, DAY_PART));
  protected readonly time = computed(() => this.value().slice(DAY_PART + 1) || DEFAULT_TIME);
  protected readonly times = computed(() => TimeOptions.quarterHours(this.time()));
  /** From today (or the saved day, if earlier) to four months ahead, named in the app language. */
  protected readonly days = computed<SelectOption[]>(() => {
    const format = new Intl.DateTimeFormat(this.transloco.getActiveLang(), { weekday: 'short', day: 'numeric', month: 'short' });
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    const saved = this.day() ? new Date(`${this.day()}T00:00`) : today;
    const first = saved < today ? saved : today;
    const count = Math.round((today.getTime() - first.getTime()) / DAY_MS) + DAYS_AHEAD;
    return Array.from({ length: count + 1 }, (_, i) => {
      const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i);
      return { value: isoDay(date), label: format.format(date) };
    });
  });

  protected setDay(day: string): void {
    this.value.set(day ? `${day}T${this.time()}` : '');
  }

  protected setTime(time: string): void {
    if (this.day()) this.value.set(`${this.day()}T${time}`);
  }
}
