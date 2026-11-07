import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { CheckoutStore } from '../../state/checkout.store';
import { CheckoutPayment } from './checkout-payment';

function render(onlineAvailable: boolean, method: 'online' | 'pay_at_pickup'): HTMLElement {
  TestBed.configureTestingModule({
    imports: [CheckoutPayment, TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
    providers: [
      provideRouter([]),
      {
        provide: CheckoutStore,
        useValue: {
          onlineAvailable: signal(onlineAvailable),
          method: signal(method),
          sandbox: signal(false),
          paymentLabelKey: signal('checkout.payment.payAtPickup'),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(CheckoutPayment);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('CheckoutPayment', () => {
  it.each([
    [true, 'online'],
    [true, 'pay_at_pickup'],
    [false, 'pay_at_pickup'],
  ] as const)('says until when the order can be cancelled (online offered: %s, %s)', (online, method) => {
    expect(render(online, method).querySelector('[data-test="cancel-rule"]')?.textContent?.trim()).toBe(
      'checkout.payment.cancelRule',
    );
  });

  it('links the refund policy only when paying online', () => {
    expect(render(true, 'online').querySelector('a[href="/legal/refunds"]')).not.toBeNull();
    TestBed.resetTestingModule();
    expect(render(true, 'pay_at_pickup').querySelector('a[href="/legal/refunds"]')).toBeNull();
  });
});
