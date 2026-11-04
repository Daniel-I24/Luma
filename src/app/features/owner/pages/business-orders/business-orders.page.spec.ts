import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { BusinessOrderRepository } from '@shared/orders/business-order.repository';
import { FakeRealtimeService } from '../../../../../testing/fake-realtime';
import { BusinessOrdersPage } from './business-orders.page';

const flush = () => new Promise((resolve) => setTimeout(resolve));
const order = (id: string, status: string, extra: object = {}) => ({
  id,
  business_id: 'b1',
  status,
  pickup_at: null,
  total_cop: 12000,
  notes: null,
  created_at: `2026-10-14T12:0${id.length}:00Z`,
  updated_at: '',
  customer_label: null,
  payment_method: 'pay_at_pickup',
  payment_status: 'none',
  cancel_reason: null,
  ready_at: null,
  customer_avatar_path: null,
  items: [{ id: `${id}-i`, order_id: id, name: 'Fritanga', unit_price_cop: 6000, quantity: 2 }],
  ...extra,
});

describe('BusinessOrdersPage', () => {
  const repo = { list: vi.fn(), setStatus: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.list.mockResolvedValue({
      data: [
        order('o1', 'pending', {
          notes: '<img src=x onerror=alert(1)> sin cebolla',
          customer_label: 'Ana P.',
        }),
        order('o22', 'preparing'),
        order('o333', 'picked_up'),
      ],
      errorKey: null,
    });
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
        { provide: BusinessOrderRepository, useValue: repo },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  async function render() {
    const fixture = TestBed.createComponent(BusinessOrdersPage);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(text))!;
    return { fixture, el, button };
  }

  it('shows new orders first, with counts in the tabs and the label never an id', async () => {
    const { el } = await render();

    expect(el.querySelectorAll('[role="tab"]')).toHaveLength(4);
    expect(el.querySelectorAll('app-owner-order-card')).toHaveLength(1);
    expect(el.querySelector('app-owner-order-card h3')?.textContent).toContain('Ana P.');
  });

  it('shows the customer notes as text, never as HTML', async () => {
    const { el } = await render();

    const card = el.querySelector('app-owner-order-card')!;
    expect(card.querySelector('img')).toBeNull();
    expect(card.textContent).toContain('<img src=x onerror=alert(1)> sin cebolla');
  });

  it('accepts a new order through set_order_status', async () => {
    repo.setStatus.mockResolvedValue({ data: true, errorKey: null });
    const { button } = await render();

    button('businessOrders.actions.accept').click();
    await flush();

    expect(repo.setStatus).toHaveBeenCalledWith('o1', 'accepted', null);
  });

  it('asks before rejecting', async () => {
    repo.setStatus.mockResolvedValue({ data: true, errorKey: null });
    const { fixture, button } = await render();

    button('businessOrders.actions.reject').click();
    fixture.detectChanges();
    expect(repo.setStatus).not.toHaveBeenCalled();
    button('businessOrders.rejectConfirm').click();
    await flush();

    expect(repo.setStatus).toHaveBeenCalledWith('o1', 'cancelled', null);
  });

  it('cancelling after accepting needs a reason', async () => {
    repo.setStatus.mockResolvedValue({ data: true, errorKey: null });
    const { fixture, el, button } = await render();
    el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]?.click();
    fixture.detectChanges();
    button('businessOrders.actions.cancel').click();
    fixture.detectChanges();
    expect(button('businessOrders.cancelConfirm').disabled).toBe(true);
    button('businessOrders.reasons.out_of_stock').click();
    fixture.detectChanges();
    button('businessOrders.cancelConfirm').click();
    await flush();
    expect(repo.setStatus).toHaveBeenCalledWith('o22', 'cancelled', 'out_of_stock');
  });

  it('"No llegó" asks for confirmation and sends no_show', async () => {
    const readyAt = new Date(Date.now() - 20 * 60_000).toISOString();
    repo.list.mockResolvedValue({ data: [order('o4', 'ready', { ready_at: readyAt })], errorKey: null });
    repo.setStatus.mockResolvedValue({ data: true, errorKey: null });
    const { fixture, el, button } = await render();
    el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[2]?.click();
    fixture.detectChanges();
    button('businessOrders.actions.noShow').click();
    fixture.detectChanges();
    expect(repo.setStatus).not.toHaveBeenCalled();
    button('businessOrders.noShowConfirm').click();
    await flush();
    expect(repo.setStatus).toHaveBeenCalledWith('o4', 'cancelled', 'no_show');
  });

  it('shows "Pagado en línea" for orders paid online', async () => {
    repo.list.mockResolvedValue({ data: [order('o5', 'pending', { payment_status: 'approved' })], errorKey: null });
    const { el } = await render();
    expect(el.textContent).toContain('businessOrders.paidOnline');
  });

  it('lists the other tabs with their next action', async () => {
    const { fixture, el } = await render();

    el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]?.click();
    fixture.detectChanges();

    expect(el.querySelector('app-owner-order-card')?.textContent).toContain(
      'businessOrders.actions.ready',
    );
  });

  it('a new order of this business arrives without refreshing; orders of other businesses do not reload it', async () => {
    await render();
    repo.list.mockClear();
    const realtime = TestBed.inject(FakeRealtimeService);

    await realtime.emit('order_events', [{ order_id: 'x', business_id: 'other' }]);
    expect(repo.list).not.toHaveBeenCalled();
    await realtime.emit('order_events', [{ order_id: 'o9', business_id: 'b1' }]);
    expect(repo.list).toHaveBeenCalledTimes(1);
  });
});
