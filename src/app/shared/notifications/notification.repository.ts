import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';
import type { OrderStatus } from '@shared/orders/order.model';

/** Who is told what (notifications_type_valid). */
export type NotificationType = 'order_status' | 'order_new' | 'order_cancelled';
/** Notifications sent to the owner of the business of the order. */
export const OWNER_NOTIFICATION_TYPES: readonly NotificationType[] = [
  'order_new',
  'order_cancelled',
];

/** Row of public.notifications (the text is built by the app from type and status). */
export interface AppNotification {
  id: string;
  type: NotificationType;
  order_id: string | null;
  status: OrderStatus | null;
  created_at: string;
  read_at: string | null;
  /** For owner notifications: the business of the order (read from business_orders). */
  business_id: string | null;
}

const COLUMNS = 'id, type, order_id, status, created_at, read_at';
const LIST_LIMIT = 50;
const LOAD_FAILED = 'notifications.errors.loadFailed';

/**
 * NotificationRepository — the signed-in user's notifications (RLS: own
 * only). Clients cannot create them; they can only mark them as read.
 */
@Injectable({ providedIn: 'root' })
export class NotificationRepository {
  private readonly db = inject(SupabaseService).client;

  /** Latest notifications, newest first. */
  async list(): Promise<RepoResult<AppNotification[]>> {
    const { data, error } = await this.db
      .from('notifications')
      .select(COLUMNS)
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT);
    if (error) return { data: null, errorKey: LOAD_FAILED };
    const rows = data as Omit<AppNotification, 'business_id'>[];
    const orderIds = rows
      .filter((n) => OWNER_NOTIFICATION_TYPES.includes(n.type) && n.order_id)
      .map((n) => n.order_id!);
    const businessOf = new Map<string, string>();
    if (orderIds.length) {
      const owned = await this.db
        .from('business_orders')
        .select('id, business_id')
        .in('id', orderIds);
      if (owned.error) return { data: null, errorKey: LOAD_FAILED };
      for (const row of owned.data as { id: string; business_id: string }[]) {
        businessOf.set(row.id, row.business_id);
      }
    }
    return {
      data: rows.map((n) => ({
        ...n,
        business_id: n.order_id ? (businessOf.get(n.order_id) ?? null) : null,
      })),
      errorKey: null,
    };
  }

  /** Number of unread notifications (a HEAD count, no rows). */
  async unreadCount(): Promise<RepoResult<number>> {
    const { count, error } = await this.db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);
    if (error) return { data: null, errorKey: LOAD_FAILED };
    return { data: count ?? 0, errorKey: null };
  }

  /** Marks every unread notification as read. */
  async markAllRead(now: Date = new Date()): Promise<RepoResult<true>> {
    const { error } = await this.db
      .from('notifications')
      .update({ read_at: now.toISOString() })
      .is('read_at', null);
    if (error) return { data: null, errorKey: 'notifications.errors.markFailed' };
    return { data: true, errorKey: null };
  }
}
