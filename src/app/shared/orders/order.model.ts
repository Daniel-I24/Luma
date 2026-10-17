/** Lifecycle of a pick-up order (public.orders.status). */
export const ORDER_STATUSES = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Steps shown on the timeline, in order (cancelled is shown apart). */
export const ORDER_PROGRESS: readonly OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
];

/** The business fields an order screen needs. */
export interface OrderBusiness {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

/** Row of public.order_items (copies taken when the order was created). */
export interface OrderItem {
  id: string;
  menu_item_id: string | null;
  name: string;
  unit_price_cop: number;
  quantity: number;
}

/** Row of public.orders with its business (null if no longer visible). */
export interface Order {
  id: string;
  business_id: string;
  status: OrderStatus;
  /** Requested pick-up time; null = as soon as possible. */
  pickup_at: string | null;
  total_cop: number;
  notes: string | null;
  payment_method: 'pay_at_pickup';
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
}
