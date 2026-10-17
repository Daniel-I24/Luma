import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import type { OrderStatus } from './order.model';

const TONE: Record<OrderStatus, string> = {
  pending: 'bg-warning-bg text-warning-fg',
  accepted: 'bg-info-bg text-info-fg',
  preparing: 'bg-info-bg text-info-fg',
  ready: 'bg-success-bg text-success-fg',
  picked_up: 'bg-surface-selected text-fg-muted',
  cancelled: 'bg-danger-bg text-danger-fg',
};

/** OrderStatusBadge — translated status of an order, coloured by stage. */
@Component({
  selector: 'app-order-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  template: `<span [class]="classes()">{{ 'orders.status.' + status() | transloco }}</span>`,
  host: { class: 'inline-flex' },
})
export class OrderStatusBadge {
  readonly status = input.required<OrderStatus>();

  protected readonly classes = computed(
    () => `inline-flex items-center rounded-full px-2 py-0.5 text-label ${TONE[this.status()]}`,
  );
}
