import { TestBed } from '@angular/core/testing';
import { Router, convertToParamMap, provideRouter, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppEvents } from '@core/native/app-events';
import { ExternalBrowser } from '@core/native/native-actions';
import { PaymentGatewayFactory } from './payment-gateway';
import { PaymentRepository } from './payment.repository';
import { PaymentReturn } from './payment-return';
import { webReturnGuard } from './payment-return.routes';

const ORDER = '11111111-1111-4111-8111-111111111111';

describe('payments in the app', () => {
  const repo = { checkoutUrl: vi.fn(), recordRedirect: vi.fn().mockResolvedValue(undefined) };
  const browser = { open: vi.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PaymentRepository, useValue: repo },
        { provide: ExternalBrowser, useValue: browser },
      ],
    });
  });

  it('pay at pick-up does nothing online', async () => {
    expect(await TestBed.inject(PaymentGatewayFactory).for('pay_at_pickup').start(ORDER)).toEqual({ kind: 'pay_at_pickup' });
    expect(repo.checkoutUrl).not.toHaveBeenCalled();
  });

  it('online opens only a Wompi checkout link in the system browser', async () => {
    const online = TestBed.inject(PaymentGatewayFactory).for('online');
    repo.checkoutUrl.mockResolvedValueOnce({ data: 'https://checkout.wompi.co/p/?reference=luma_x', errorKey: null });
    expect(await online.start(ORDER)).toEqual({ kind: 'redirected' });
    expect(browser.open).toHaveBeenCalledWith('https://checkout.wompi.co/p/?reference=luma_x');
    repo.checkoutUrl.mockResolvedValueOnce({ data: 'https://evil.example/p/', errorKey: null });
    expect(await online.start(ORDER)).toEqual({ kind: 'failed', errorKey: 'payments.errors.unavailable' });
    repo.checkoutUrl.mockResolvedValueOnce({ data: null, errorKey: 'payments.errors.tooManyAttempts' });
    expect(await online.start(ORDER)).toEqual({ kind: 'failed', errorKey: 'payments.errors.tooManyAttempts' });
    repo.checkoutUrl.mockResolvedValueOnce({ data: null, errorKey: 'payments.errors.attemptInProgress', retryAfterSeconds: 40 });
    expect(await online.start(ORDER)).toEqual({
      kind: 'failed', errorKey: 'payments.errors.attemptInProgress', retryAfterSeconds: 40,
    });
    expect(browser.open).toHaveBeenCalledTimes(1);
  });

  it('parses only well-formed return links', () => {
    expect(PaymentReturn.parse(`luma://payments/return?order=${ORDER}&id=1234-1610641025-49201`))
      .toEqual({ orderId: ORDER, transactionId: '1234-1610641025-49201' });
    expect(PaymentReturn.parse(`luma://payments/return?order=${ORDER}&id=x;drop`)).toEqual({ orderId: ORDER, transactionId: null });
    expect(PaymentReturn.parse('luma://payments/return?order=../../admin')).toBeNull();
    expect(PaymentReturn.parse(`https://evil.example/?order=${ORDER}`)).toBeNull();
  });

  it('a return link stores the transaction id and opens the order; the server decides the status', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(PaymentReturn).init();
    TestBed.inject(AppEvents).emit(`luma://payments/return?order=${ORDER}&id=99-1`);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(['/orders', ORDER]));
    expect(repo.recordRedirect).toHaveBeenCalledWith(ORDER, '99-1');
    TestBed.inject(AppEvents).emit('luma://something/else');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('on the web, Wompi returns to /payments/return: the same, then the order (or the list when malformed)', async () => {
    const run = (query: Record<string, string>) => TestBed.runInInjectionContext(() =>
      webReturnGuard({ queryParamMap: convertToParamMap(query) } as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    const opened = await run({ order: ORDER, id: '99-1', env: 'test' });
    expect(TestBed.inject(Router).serializeUrl(opened as never)).toBe(`/orders/${ORDER}`);
    expect(repo.recordRedirect).toHaveBeenCalledWith(ORDER, '99-1');
    const bad = await run({ order: '../../admin' });
    expect(TestBed.inject(Router).serializeUrl(bad as never)).toBe('/orders');
  });
});
