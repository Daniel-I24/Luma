import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import { pickOption } from '../../../../../testing/select.harness';
import { TimeOptions } from '../../utils/time-options';
import { DateTimeFields } from './date-time-fields';

describe('TimeOptions', () => {
  it('every quarter of an hour, and a saved time between them stays', () => {
    expect(TimeOptions.quarterHours()).toHaveLength(96);
    const values = TimeOptions.quarterHours('08:10').map((o) => o.value);
    expect(values.slice(32, 35)).toEqual(['08:00', '08:10', '08:15']);
  });
});

describe('DateTimeFields', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DateTimeFields, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
    });
  });

  function render(value: string) {
    const fixture = TestBed.createComponent(DateTimeFields);
    fixture.componentRef.setInput('fieldId', 'promo-starts');
    fixture.componentRef.setInput('label', 'Empieza');
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    return fixture;
  }

  it('a day and a time, from the app sheets, make "YYYY-MM-DDTHH:MM"', () => {
    const fixture = render('');
    const today = new Date();
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    pickOption(fixture, 'promo-starts', day);
    expect(fixture.componentInstance.value()).toBe(`${day}T08:00`);
    pickOption(fixture, 'promo-starts-time', '19:30');
    expect(fixture.componentInstance.value()).toBe(`${day}T19:30`);
    expect((fixture.nativeElement as HTMLElement).querySelector('input')).toBeNull();
  });

  it('a saved day in the past can still be shown and kept', () => {
    const fixture = render('2026-01-05T10:00');
    expect((fixture.nativeElement as HTMLElement).querySelector('#promo-starts')?.textContent).not.toContain('dateTime.chooseDay');
    pickOption(fixture, 'promo-starts-time', '11:00');
    expect(fixture.componentInstance.value()).toBe('2026-01-05T11:00');
  });

  it('no day: choosing a time alone keeps it empty', () => {
    const fixture = render('');
    pickOption(fixture, 'promo-starts-time', '09:00');
    expect(fixture.componentInstance.value()).toBe('');
  });
});
