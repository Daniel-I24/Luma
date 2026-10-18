import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROMOTION_ADVISOR } from '@shared/promotions/advisor/promotion-advisor';
import type { PromotionIdea } from '@shared/promotions/advisor/promotion-idea';
import { IdeasCard } from './ideas-card';

const idea: PromotionIdea = {
  menu_item_id: 'm1',
  item_name: 'Empanada',
  discount_percent: 15,
  duration_days: 7,
  reason: 'slow_item',
  list_cop: 9990,
  final_cop: 8492,
  units_60d: 0,
  days_listed: 40,
  slot: null,
};

describe('IdeasCard', () => {
  const advisor = { suggest: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [
        IdeasCard,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [{ provide: PROMOTION_ADVISOR, useValue: advisor }],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(IdeasCard);
    fixture.componentRef.setInput('businessId', 'b1');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('[aria-busy="true"]')).toBeNull();
    });
    return { fixture, el };
  }

  it('shows each idea with its reason, final price and the margin notice; "Crear" only emits', async () => {
    advisor.suggest.mockResolvedValue({ source: 'ai', ideas: [idea] });
    const { fixture, el } = await render();
    const created: PromotionIdea[] = [];
    fixture.componentInstance.create.subscribe((value) => created.push(value));

    expect(advisor.suggest).toHaveBeenCalledWith('b1');
    expect(el.textContent).toContain('owner.ideas.reasons.slow_item');
    expect(el.textContent).toContain('owner.discount.preview');
    expect(el.textContent).toContain('owner.ideas.margin');
    expect(el.textContent).toContain('owner.ideas.sourceAi');
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('owner.ideas.create'))!
      .click();
    expect(created).toEqual([idea]);
  });

  it('shows an error with a retry', async () => {
    advisor.suggest.mockRejectedValue(new Error('down'));
    const { el } = await render();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('owner.ideas.loadFailed');
  });
});
