import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';
import { mapOrderError } from './order-error';
import type { OrderStatus } from './order.model';

/** Row of public.business_order_items. */
export interface BusinessOrderItem {
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
  items: BusinessOrderItem[];
}

/** Statuses an owner can move an order to (set_order_status). */
export type OwnerOrderAction = 'accepted' | 'cancelled' | 'preparing' | 'ready' | 'picked_up';

const ORDER_COLUMNS =
  'id, business_id, status, pickup_at, total_cop, notes, created_at, updated_at, customer_label';
const LIST_LIMIT = 100;

/**
 * BusinessOrderRepository — orders placed at one of the user's businesses,
 * read through the owner-only views, and their status changes.
 */
@Injectable({ providedIn: 'root' })
export class BusinessOrderRepository {
  private readonly db = inject(SupabaseService).client;

  /** Latest orders of the business with their lines, newest first. */
  async list(businessId: string): Promise<RepoResult<BusinessOrder[]>> {
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

  /** Moves an order forward; the server accepts only valid transitions. */
  async setStatus(orderId: string, status: OwnerOrderAction): Promise<RepoResult<true>> {
    const { error } = await this.db.rpc('set_order_status', {
      p_order_id: orderId,
      p_status: status,
    });
    if (error)
      return {
        data: null,
        errorKey: mapOrderError(error.message, 'businessOrders.errors.updateFailed'),
      };
    return { data: true, errorKey: null };
  }
}
