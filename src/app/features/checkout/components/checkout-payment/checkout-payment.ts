import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaIcon } from '@design-system';
import { CheckoutStore } from '../../state/checkout.store';

/**
 * CheckoutPayment — "¿Cómo pagas?": pay at pick-up or online (when payments
 * are on), the refund policy and the sandbox notice; otherwise the one way
 * there is. Uses the page's CheckoutStore.
 */
@Component({
  selector: 'app-checkout-payment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaButton, LumaIcon],
  template: `
    <ng-container *transloco="let t">
      @if (store.onlineAvailable()) {
      <section class="flex flex-col gap-2" data-tour="checkout-payment" aria-labelledby="checkout-payment-title">
        <h2 id="checkout-payment-title" class="m-0 text-title text-fg">{{ t('checkout.payment.title') }}</h2>
        <div class="flex flex-col gap-2" role="radiogroup" aria-labelledby="checkout-payment-title">
          @for (option of paymentMethods; track option) {
          <app-luma-button
            role="radio"
            [variant]="store.method() === option ? 'primary' : 'secondary'"
            [fullWidth]="true"
            [attr.aria-checked]="store.method() === option"
            (clicked)="store.method.set(option)"
            >{{ t(option === 'online' ? 'checkout.payment.online' : 'checkout.payment.payAtPickup') }}</app-luma-button
          >
          }
        </div>
        <p class="m-0 text-caption text-fg-subtle">
          {{ t(store.method() === 'online' ? 'checkout.payment.onlineHint' : 'checkout.payment.hint') }}
        </p>
        @if (store.method() === 'online') {
        <a routerLink="/legal/refunds" class="text-body-sm text-fg-accent underline">{{ t('checkout.payment.refundPolicy') }}</a>
        }
        @if (store.sandbox() && store.method() === 'online') {
        <p class="m-0 rounded-md bg-warning-bg p-3 text-body-sm text-warning-fg" role="note">
          {{ t('checkout.payment.sandbox') }}
        </p>
        }
      </section>
      } @else {
      <section class="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-4">
        <app-luma-icon class="text-fg-brand" name="check" />
        <div class="flex flex-col">
          <span class="text-title text-fg">{{ t(store.paymentLabelKey()) }}</span>
          <span class="text-caption text-fg-subtle">{{ t('checkout.payment.hint') }}</span>
        </div>
      </section>
      }
    </ng-container>
  `,
  host: { class: 'block' },
})
export class CheckoutPayment {
  protected readonly store = inject(CheckoutStore);
  protected readonly paymentMethods = ['pay_at_pickup', 'online'] as const;
}
