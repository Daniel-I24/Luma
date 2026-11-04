import { Injectable, inject } from '@angular/core';
import { PanelQueryLog } from '@shared/business/diagnostics/panel-query-log';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';
import { OrderErrors } from './order-error';
import type { OrderStatus } from './order.model';

/** Row of public.business_order_items. */
interface BusinessOrderItem {
  id: string;
  order_id: string;
  name: string;
  unit_price_cop: number;
  quantity: number;
}

/** Row of public.business_orders (never user_id or email) with its lines. */
export interface BusinessOrder {
  id: string;
  business_id: string;
  status: OrderStatus;
  pickup_at: string | null;
  total_cop: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** The customer's public display name, or null ("Cliente"). */
  customer_label: string | null;
  payment_method: 'pay_at_pickup' | 'online';
  /** 'approved' for orders paid online ("Pagado en línea"). */
  payment_status: string;
  cancel_reason: CancelReason | null;
  /** When the order became ready (the no-show wait starts there). */
  ready_at: string | null;
  /** Private avatar object, only while serving and if the customer shares it. */
  customer_avatar_path: string | null;
  items: BusinessOrderItem[];
}

/** Why an owner cancels an order after accepting it (set_order_status p_reason). */
export type CancelReason = 'out_of_stock' | 'closed' | 'no_show' | 'other';

/** Statuses an owner can move an order to (set_order_status). */
export type OwnerOrderAction = 'accepted' | 'cancelled' | 'preparing' | 'ready' | 'picked_up';

const ORDER_COLUMNS =
  'id, business_id, status, pickup_at, total_cop, notes, created_at, updated_at, customer_label, payment_method, payment_status, cancel_reason, ready_at, customer_avatar_path';
const LIST_LIMIT = 100;

/**
 * BusinessOrderRepository — orders placed at one of the user's businesses,
 * read through the owner-only views, and their status changes.
 */
@Injectable({ providedIn: 'root' })
export class BusinessOrderRepository {
  private readonly db = inject(SupabaseService).client;
  private readonly log = inject(PanelQueryLog);

  /** Ids of the orders waiting for the business to accept them (light, for alerts). */
  public async pendingIds(businessId: string): Promise<RepoResult<string[]>> {
    const { data, error } = await this.db
      .from('business_orders')
      .select('id')
      .eq('business_id', businessId)
      .eq('status', 'pending')
      .limit(LIST_LIMIT);
    this.log.record('business_orders', PanelQueryLog.filter('business_id', businessId), error ? null : (data?.length ?? 0));
    if (error) return { data: null, errorKey: 'businessOrders.errors.loadFailed' };
    return { data: (data as { id: string }[]).map((row) => row.id), errorKey: null };
  }

  /** Latest orders of the business with their lines, newest first. */
  public async list(businessId: string): Promise<RepoResult<BusinessOrder[]>> {
    const { data, error } = await this.db
      .from('business_orders')
      .select(ORDER_COLUMNS)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT);
    if (error) return { data: null, errorKey: 'businessOrders.errors.loadFailed' };
    const orders = data as Omit<BusinessOrder, 'items'>[];
    if (orders.length === 0) return { data: [], errorKey: null };

    const lines = await this.db
      .from('business_order_items')
      .select('id, order_id, name, unit_price_cop, quantity')
      .in(
        'order_id',
        orders.map((order) => order.id),
      );
    if (lines.error) return { data: null, errorKey: 'businessOrders.errors.loadFailed' };
    const items = lines.data as BusinessOrderItem[];
    return {
      data: orders.map((order) => ({
        ...order,
        items: items.filter((i) => i.order_id === order.id),
      })),
      errorKey: null,
    };
  }

  /** Moves an order forward; the server accepts only valid transitions and checks the reason. */
  public async setStatus(
    orderId: string,
    status: OwnerOrderAction,
    reason: CancelReason | null = null,
  ): Promise<RepoResult<true>> {
    const { error } = await this.db.rpc('set_order_status', {
      p_order_id: orderId,
      p_status: status,
      p_reason: reason,
    });
    if (error)
      return {
        data: null,
        errorKey: OrderErrors.mapOrderError(error.message, 'businessOrders.errors.updateFailed'),
      };
    return { data: true, errorKey: null };
  }
}
