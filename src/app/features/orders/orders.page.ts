import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComingSoonPage } from '@shared/layout/coming-soon-page/coming-soon-page';

/** OrdersPage — /orders (protected by authGuard). Order history and tracking; not built yet. */
@Component({
  selector: 'app-orders-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ComingSoonPage],
  templateUrl: './orders.page.html',
  host: { class: 'block h-full' },
})
export class OrdersPage {}
