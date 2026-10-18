import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromotionInput } from '@shared/business/data/business-write.schemas';
import { BusinessImageRepository } from '@shared/media/business-image.repository';
import { PromotionForm } from './promotion-form';

const items = [
  { id: 'm1', business_id: 'b1', name: 'Empanada', price_cop: 9990, is_available: true },
] as never[];

describe('PromotionForm with a discount', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        PromotionForm,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        { provide: BusinessImageRepository, useValue: { upload: vi.fn(), remove: vi.fn() } },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(PromotionForm);
    fixture.componentRef.setInput('businessId', 'b1');
    fixture.componentRef.setInput('items', items);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const submitted: PromotionInput[] = [];
    fixture.componentInstance.submitted.subscribe((input) => submitted.push(input));
    const type = (id: string, value: string) => {
      const field = el.querySelector<HTMLInputElement>(`#${id}`)!;
      field.value = value;
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const choose = (value: string) => {
      const select = el.querySelector<HTMLSelectElement>('#promo-item')!;
      select.value = value;
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const submit = () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      fixture.detectChanges();
    };
    return { el, type, choose, submit, submitted };
  }

  it('previews the final price and sends the item and percent', () => {
    const { el, type, choose, submit, submitted } = render();
    type('promo-title', 'Empanada feliz');
    choose('m1');
    type('promo-percent', '15');

    expect(el.textContent).toContain('owner.discount.preview');
    expect(el.textContent).toContain('owner.discount.margin');
    submit();

    expect(submitted[0]).toMatchObject({ menu_item_id: 'm1', discount_percent: 15 });
  });

  it('rejects percents outside 5-90 and sends no discount without a product', () => {
    const { el, type, choose, submit, submitted } = render();
    type('promo-title', 'Empanada feliz');
    choose('m1');
    type('promo-percent', '95');
    submit();

    expect(submitted).toEqual([]);
    expect(el.textContent).toContain('businessPanel.validation.discount');

    choose('');
    submit();
    expect(submitted[0]).toMatchObject({ menu_item_id: null, discount_percent: null });
  });
});
