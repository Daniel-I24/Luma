import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import type { OrderStatus } from './order.model';
import { OrderTimeline } from './order-timeline';

describe('OrderTimeline', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        OrderTimeline,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
    });
  });

  const render = (status: OrderStatus): HTMLElement => {
    const fixture = TestBed.createComponent(OrderTimeline);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const filled = (root: HTMLElement): number =>
    root.querySelectorAll('li .bg-primary.border-primary').length;

  it('picked up: every circle is filled, the last one included, and nothing is pending', () => {
    const root = render('picked_up');
    expect(filled(root)).toBe(5);
    expect(root.querySelectorAll('app-luma-icon').length).toBe(5);
    expect(root.querySelector('[aria-current="step"]')).toBeNull();
  });

  it('preparing: the two before are filled, the current one is marked', () => {
    const root = render('preparing');
    expect(filled(root)).toBe(2);
    expect(root.querySelector('[aria-current="step"]')?.textContent).toContain(
      'orders.status.preparing',
    );
  });
});
