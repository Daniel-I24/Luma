import { Injectable, inject } from '@angular/core';
import * as z from 'zod/mini';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';
import { mapOrderError } from './order-error';
import type { NewOrder, Order, OrderWithItems } from './order.model';

const ORDER_COLUMNS =
  'id, business_id, status, pickup_at, total_cop, notes, payment_method, created_at, updated_at, ' +
  'business:businesses(id, name, address, latitude, longitude)';

/** create_order returns the new order id. */
const orderIdSchema = z.uuid();

/**
 * OrderRepository — the signed-in user's pick-up orders. Reads go through
 * RLS (own orders only); creating and cancelling go through the database
 * functions, which recalculate prices and enforce every rule.
 */
@Injectable({ providedIn: 'root' })
export class OrderRepository {
  private readonly db = inject(SupabaseService).client;

  /** Creates a pending order; resolves to its id. Only ids and quantities are sent. */
  async create(order: NewOrder): Promise<RepoResult<string>> {
    const { data, error } = await this.db.rpc('create_order', {
      p_business_id: order.businessId,
      p_items: order.items.map((item) => ({ menu_item_id: item.menuItemId, quantity: item.quantity })),
      p_pickup_at: order.pickupAt,
      p_notes: order.notes,
    });
    if (error) return { data: null, errorKey: mapOrderError(error.message, 'orders.errors.createFailed') };
    const id = orderIdSchema.safeParse(data);
    if (!id.success) return { data: null, errorKey: 'orders.errors.createFailed' };
    return { data: id.data, errorKey: null };
  }

  /** The user's orders, newest first. */
  async list(): Promise<RepoResult<Order[]>> {
    const { data, error } = await this.db
      .from('orders')
      .select(ORDER_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return { data: null, errorKey: 'orders.errors.loadFailed' };
    return { data: data as unknown as Order[], errorKey: null };
  }

  /** One order with its lines, or null when it does not exist (or is not the user's). */
  async getById(id: string): Promise<RepoResult<OrderWithItems | null>> {
    const { data, error } = await this.db
      .from('orders')
      .select(`${ORDER_COLUMNS}, items:order_items(id, menu_item_id, name, unit_price_cop, quantity)`)
      .eq('id', id)
      .maybeSingle();
    if (error) return { data: null, errorKey: 'orders.errors.loadFailed' };
    return { data: data as unknown as OrderWithItems | null, errorKey: null };
  }

  async cancel(id: string): Promise<RepoResult<true>> {
    const { error } = await this.db.rpc('cancel_order', { p_order_id: id });
    if (error) return { data: null, errorKey: mapOrderError(error.message, 'orders.errors.cancelFailed') };
    return { data: true, errorKey: null };
  }
}
