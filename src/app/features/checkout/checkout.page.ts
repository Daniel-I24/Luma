import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComingSoonPage } from '@shared/layout/coming-soon-page/coming-soon-page';

/** CheckoutPage — /checkout: confirming the order from the cart; not built yet. */
@Component({
  selector: 'app-checkout-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ComingSoonPage],
  template: `<app-coming-soon-page titleKey="checkout.title" descriptionKey="checkout.comingSoon" icon="receipt" />`,
  host: { class: 'block h-full' },
})
export class CheckoutPage {}
