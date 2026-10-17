import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PromotionInput } from '@shared/business/data/business-write.schemas';
import { useFixedClock } from '../../../../../testing/fixed-clock';
import { PromotionForm } from './promotion-form';

describe('PromotionForm', () => {
  useFixedClock('2026-10-14T12:00:00');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        PromotionForm,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(PromotionForm);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const emitted: PromotionInput[] = [];
    fixture.componentInstance.submitted.subscribe((value) => emitted.push(value));
    const type = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const submit = () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };
    return { fixture, el, emitted, type, submit };
  }

  it('starts now and ends a week later', async () => {
    const { fixture, el } = render();
    await fixture.whenStable();

    expect(el.querySelector<HTMLInputElement>('#promo-starts')!.value).toBe('2026-10-14T12:00');
    expect(el.querySelector<HTMLInputElement>('#promo-ends')!.value).toBe('2026-10-21T12:00');
  });

  it('requires the end after the start', () => {
    const { el, emitted, type, submit } = render();
    type('promo-title', '2x1 viernes');
    type('promo-ends', '2026-10-13T12:00');

    submit();

    expect(emitted).toEqual([]);
    expect(el.textContent).toContain('businessPanel.validation.datesOrder');
    expect(document.activeElement?.id).toBe('promo-ends');
  });

  it('requires the end in the future', () => {
    const { el, emitted, type, submit } = render();
    type('promo-title', '2x1 viernes');
    type('promo-starts', '2026-10-01T12:00');
    type('promo-ends', '2026-10-10T12:00');

    submit();

    expect(emitted).toEqual([]);
    expect(el.textContent).toContain('businessPanel.validation.endsInPast');
  });

  it('emits ISO dates for a valid promotion', () => {
    const { emitted, type, submit } = render();
    type('promo-title', '2x1 viernes');

    submit();

    expect(emitted).toEqual([
      {
        title: '2x1 viernes',
        description: null,
        image_url: null,
        starts_at: new Date('2026-10-14T12:00:00').toISOString(),
        ends_at: new Date('2026-10-21T12:00:00').toISOString(),
      },
    ]);
  });
});
