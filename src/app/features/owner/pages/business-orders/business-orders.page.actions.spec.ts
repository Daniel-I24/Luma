import { describe, expect, it } from 'vitest';
import { businessOrdersPageHarness, flush, order } from './business-orders.page.harness';

describe('BusinessOrdersPage: actions', () => {
  const h = businessOrdersPageHarness();
  const { repo, render } = h;

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
});
