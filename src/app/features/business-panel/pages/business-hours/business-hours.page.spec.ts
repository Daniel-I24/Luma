import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessHoursWriteRepository } from '@shared/business/data/business-hours-write.repository';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { BusinessHoursPage } from './business-hours.page';

const flush = () => new Promise((resolve) => setTimeout(resolve));
const monday = {
  day_of_week: 1,
  opens_at: '18:00:00',
  closes_at: '02:00:00',
  is_closed: false,
};

describe('BusinessHoursPage', () => {
  const writer = { saveWeek: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'b1' })) } },
        {
          provide: OwnedBusinessRepository,
          useValue: { getMine: vi.fn().mockResolvedValue({ data: { id: 'b1' }, errorKey: null }) },
        },
        {
          provide: BusinessRepository,
          useValue: { getHours: vi.fn().mockResolvedValue({ data: [monday], errorKey: null }) },
        },
        { provide: BusinessHoursWriteRepository, useValue: writer },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(BusinessHoursPage);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await flush();
      fixture.detectChanges();
    };
    return { fixture, el, submit };
  }

  it('shows the 7 days from Monday and warns when the hours cross midnight', async () => {
    const { el } = await render();

    expect(el.querySelectorAll('fieldset')).toHaveLength(7);
    expect(el.querySelector('legend')?.textContent).toContain('businessPanel.hours.days.1');
    expect(el.querySelector('[role="status"]')?.textContent).toContain(
      'businessPanel.hours.crossesMidnight',
    );
    expect(el.querySelectorAll('input[type="time"]')).toHaveLength(2);
  });

  it('opens a closed day and saves the whole week', async () => {
    writer.saveWeek.mockResolvedValue({ data: true, errorKey: null });
    const { el, fixture, submit } = await render();
    const tuesday = el.querySelector<HTMLInputElement>('#hours-2-open')!;
    tuesday.click();
    fixture.detectChanges();

    await submit();

    const [id, week] = writer.saveWeek.mock.calls[0];
    expect(id).toBe('b1');
    expect(week).toHaveLength(7);
    expect(week[1]).toEqual({
      day_of_week: 2,
      is_closed: false,
      opens_at: '08:00',
      closes_at: '18:00',
    });
  });

  it('rejects equal opening and closing times and focuses that day', async () => {
    const { el, fixture, submit } = await render();
    const closes = el.querySelector<HTMLInputElement>('#hours-1-closes')!;
    closes.value = '18:00';
    closes.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await submit();

    expect(writer.saveWeek).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('hours-1-closes');
    expect(el.textContent).toContain('businessPanel.validation.sameTimes');
  });
});
