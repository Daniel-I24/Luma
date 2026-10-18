import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  LumaBottomSheet,
  LumaButton,
  LumaEmptyState,
  LumaTabs,
  type TabItem,
  ToastService,
  tabPanelId,
} from '@design-system';
import type { BusinessOrder } from '@shared/orders/business-order.repository';
import { pollWhileVisible } from '@shared/ui/poll-while-visible';
import { OwnerOrderCard } from '../../components/owner-order-card/owner-order-card';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import { BusinessOrdersStore } from '../../state/business-orders.store';
import { PanelBusinessStore } from '../../state/panel-business.store';
import {
  ORDER_TABS,
  type OrderAction,
  type OrderTab,
  ordersOfTab,
} from '../../utils/order-board.util';
import { routeBusinessId } from '../../utils/route-business-id';

/** Refresh period while the screen is visible. */
export const BOARD_REFRESH_MS = 15_000;

/** BusinessOrdersPage — /owner/:id/orders: new, in preparation, ready and history. */
@Component({
  selector: 'app-business-orders-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaBottomSheet,
    LumaButton,
    LumaEmptyState,
    LumaTabs,
    OwnerOrderCard,
    PanelHeader,
    PanelStateView,
  ],
  providers: [PanelBusinessStore, BusinessOrdersStore],
  templateUrl: './business-orders.page.html',
  host: { class: 'block' },
})
export class BusinessOrdersPage {
  protected readonly panel = inject(PanelBusinessStore);
  protected readonly board = inject(BusinessOrdersStore);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  protected readonly id = routeBusinessId();

  protected readonly tab = signal<OrderTab>('new');
  protected readonly rejecting = signal<BusinessOrder | null>(null);
  protected readonly panelId = tabPanelId;

  protected readonly tabs = computed<TabItem[]>(() => {
    this.lang();
    return ORDER_TABS.map((tab) => ({
      id: tab,
      label: this.transloco.translate('businessOrders.tabLabel', {
        label: this.transloco.translate(`businessOrders.tabs.${tab}`),
        count: ordersOfTab(this.board.orders(), tab).length,
      }),
    }));
  });
  protected readonly visible = computed(() => ordersOfTab(this.board.orders(), this.tab()));

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.load(id));
    });
    pollWhileVisible(() => void this.board.refresh(), BOARD_REFRESH_MS);
  }

  protected async load(id = this.id()): Promise<void> {
    await Promise.all([this.panel.load(id), this.board.load(id)]);
  }

  protected onAction(order: BusinessOrder, action: OrderAction): void {
    if (action.confirm) this.rejecting.set(order);
    else void this.apply(order, action.status);
  }

  protected confirmReject(): void {
    const order = this.rejecting();
    this.rejecting.set(null);
    if (order) void this.apply(order, 'cancelled');
  }

  private async apply(order: BusinessOrder, status: OrderAction['status']): Promise<void> {
    if (await this.board.act(order, status)) {
      this.toast.show({ messageKey: 'businessOrders.updated', tone: 'success' });
    }
  }
}
