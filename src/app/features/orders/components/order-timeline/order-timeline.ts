import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon } from '@design-system';
import type { OrderStatus } from '@shared/orders/order.model';
import { OrderDetailView } from '../../utils/order-detail-view';

/** OrderTimeline — the steps of an order with the current one highlighted. */
@Component({
  selector: 'app-order-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIcon],
  template: `
    <ol
      *transloco="let t"
      class="m-0 flex list-none flex-col gap-0 p-0"
      [attr.aria-label]="t('orders.detail.timeline')"
    >
      @for (step of steps(); track step.status; let last = $last) {
        <li class="flex gap-3" [attr.aria-current]="step.state === 'current' ? 'step' : null">
          <span class="flex flex-col items-center">
            <span
              class="inline-flex size-7 items-center justify-center rounded-full border-2 transition-colors duration-(--duration-normal)"
              [class]="dotClass[step.state]"
            >
              @if (step.state === 'done') {
                <app-luma-icon name="check" size="sm" />
              }
            </span>
            @if (!last) {
              <span class="relative min-h-6 w-0.5 flex-1 overflow-hidden bg-border">
                <span
                  class="motion-advance absolute inset-0 origin-top bg-primary"
                  [style.transform]="step.state === 'done' ? 'scaleY(1)' : 'scaleY(0)'"
                ></span>
              </span>
            }
          </span>
          <span
            class="pb-4 text-body"
            [class]="step.state === 'upcoming' ? 'text-fg-subtle' : 'font-semibold text-fg'"
          >
            {{ t('orders.status.' + step.status) }}
          </span>
        </li>
      }
    </ol>
  `,
})
export class OrderTimeline {
  public readonly status = input.required<OrderStatus>();

  protected readonly steps = computed(() => OrderDetailView.timelineSteps(this.status()));
  protected readonly dotClass = {
    done: 'border-primary bg-primary text-primary-fg',
    current: 'border-primary bg-surface-selected text-fg-brand',
    upcoming: 'border-border bg-surface text-fg-subtle',
  } as const;
}
