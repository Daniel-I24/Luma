/** Lifecycle of a pick-up order (public.orders.status). */
export type OrderStatus =
  // Online orders until their payment is approved (never shown to the business).
  | 'awaiting_payment'
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'cancelled';

/** public.orders.payment_status (written only by the payment functions). */
export type PaymentStatus =
  | 'none' | 'pending' | 'approved' | 'declined' | 'voided' | 'refund_required' | 'refunded' | 'error' | 'expired';

/** Steps shown on the timeline, in order (cancelled is shown apart). */
export const ORDER_PROGRESS: readonly OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
];

/** Live business data an order screen needs (null once it is gone or hidden). */
interface OrderBusiness {
  id: string;
  latitude: number;
  longitude: number;
  /** Usual preparation time in minutes. */
  prep_minutes: number;
}

/** Row of public.order_items (copies taken when the order was created). */
interface OrderItem {
  id: string;
  menu_item_id: string | null;
  name: string;
  unit_price_cop: number;
  quantity: number;
}

/** Row of public.orders with its business (null if no longer visible). */
export interface Order {
  id: string;
  /** Null once the business was deleted; the copies below remain. */
  business_id: string | null;
  /** Copies taken when the order was created. */
  business_name: string;
  business_address: string;
  status: OrderStatus;
  /** Requested pick-up time; null = as soon as possible. */
  pickup_at: string | null;
  total_cop: number;
  notes: string | null;
  payment_method: 'pay_at_pickup' | 'online';
  /** none, pending, approved, declined, voided, refund_required, refunded or error. */
  payment_status: PaymentStatus;
  /** Why the business cancelled it, when it did after accepting. */
  cancel_reason: 'out_of_stock' | 'closed' | 'no_show' | 'other' | 'customer' | 'payment_expired' | null;
  created_at: string;
  updated_at: string;
  business: OrderBusiness | null;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

/** What the app sends to create an order: ids and quantities, never prices. */
export interface NewOrder {
  businessId: string;
  items: { menuItemId: string; quantity: number }[];
  /** ISO time, or null for as soon as possible. */
  pickupAt: string | null;
  notes: string | null;
  /** Defaults to paying at pick-up; 'online' starts in awaiting_payment. */
  paymentMethod?: 'pay_at_pickup' | 'online';
}
