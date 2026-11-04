/**
 * The database functions and Edge Functions the e2e flows call, over the
 * in-memory tables. Each one follows the real contract (arguments, answer and
 * error codes), not its rules in full: the SQL suites test those.
 */
import { randomUUID } from 'node:crypto';

const now = () => new Date().toISOString();

/** Functions of /rest/v1/rpc/<name>: (db, args, ctx) → value, or { error }. */
export const RPC = {
  payment_config: (db, _args, ctx) => [{ enabled: ctx.payments, sandbox: true }],
  create_order: (db, args, ctx) => {
    if (!ctx.userId) return { error: 'not_authenticated' };
    const business = db.businesses.find((b) => b.id === args.p_business_id && b.is_active);
    if (!business) return { error: 'business_unavailable' };
    const online = args.p_payment_method === 'online';
    const id = randomUUID();
    let total = 0;
    for (const line of args.p_items) {
      const item = db.menu_items.find((m) => m.id === line.menu_item_id && m.business_id === business.id && m.is_available);
      if (!item) return { error: 'item_unavailable' };
      total += item.price_cop * line.quantity;
      db.order_items.push({ id: randomUUID(), order_id: id, menu_item_id: item.id, name: item.name, unit_price_cop: item.price_cop, quantity: line.quantity });
    }
    db.orders.push({
      id, user_id: ctx.userId, business_id: business.id, business_name: business.name, business_address: business.address,
      status: online ? 'awaiting_payment' : 'pending', pickup_at: args.p_pickup_at, total_cop: total, notes: args.p_notes,
      payment_method: online ? 'online' : 'pay_at_pickup', payment_status: online ? 'pending' : null, cancel_reason: null,
      ready_at: null, created_at: now(), updated_at: now(),
    });
    db.notifications.push({ id: randomUUID(), user_id: business.owner_id, type: 'order_new', order_id: id, business_id: business.id, status: 'pending', read_at: null, created_at: now() });
    ctx.emit('order_events', { order_id: id, user_id: ctx.userId, business_id: business.id });
    return id;
  },
  set_order_status: (db, args, ctx) => {
    const order = db.orders.find((o) => o.id === args.p_order_id);
    const business = order && db.businesses.find((b) => b.id === order.business_id);
    if (!order || business?.owner_id !== ctx.userId) return { error: 'order_not_found' };
    Object.assign(order, { status: args.p_status, updated_at: now(), ready_at: args.p_status === 'ready' ? now() : order.ready_at });
    db.notifications.push({ id: randomUUID(), user_id: order.user_id, type: 'order_status', order_id: order.id, business_id: order.business_id, status: args.p_status, read_at: null, created_at: now() });
    ctx.emit('order_events', { order_id: order.id, user_id: order.user_id, business_id: order.business_id });
    return null;
  },
  cancel_order: (db, args, ctx) => {
    const order = db.orders.find((o) => o.id === args.p_order_id && o.user_id === ctx.userId);
    if (!order) return { error: 'order_not_found' };
    Object.assign(order, { status: 'cancelled', updated_at: now() });
    return null;
  },
  my_order_payment: (db, args) => {
    const order = db.orders.find((o) => o.id === args.p_order_id);
    return order ? [{ payment_status: order.payment_status, attempts_used: order.payment_status === 'approved' ? 1 : 0, attempts_max: 3,
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString() }] : [];
  },
  record_payment_redirect: () => null,
  // Nobody in the simulated data is in the review team.
  admin_access: () => 'none',
  my_trust_status: () => [{ tier: 'new', strikes: 0, restricted_until: null, picked_up: 0, picked_up_needed: 3 }],
  owner_sales_summary: () => ({ orders: 0, cancel_rate: 0, items: [], slots: [] }),
  owner_sales_daily: () => ({ days: [], top_items: [] }),
  mark_notifications_read: (db, _args, ctx) => {
    for (const n of db.notifications) if (n.user_id === ctx.userId && !n.read_at) n.read_at = now();
    return null;
  },
};

/** Edge Functions of /functions/v1/<name>. */
export const FUNCTIONS = {
  /** Sandbox checkout: a local stand-in for Wompi's page that approves and returns. */
  'create-payment': (db, body, ctx) => {
    const order = db.orders.find((o) => o.id === body.order_id && o.user_id === ctx.userId);
    if (!order || order.status !== 'awaiting_payment') return { status: 409, body: { error: 'order_not_payable' } };
    const redirect = `${ctx.origin}/payments/return?order=${order.id}`;
    return { status: 200, body: { checkout_url: `https://checkout.wompi.co/p/?reference=luma_${order.id.slice(0, 8)}&redirect-url=${encodeURIComponent(redirect)}`, expires_at: now(), attempt: 1, sandbox: true } };
  },
};

/** What the simulated Wompi sandbox does when the customer pays: the webhook settles the order. */
export function approvePayment(db, orderId, emit) {
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) return;
  Object.assign(order, { payment_status: 'approved', status: 'pending', updated_at: now() });
  emit('order_events', { order_id: order.id, user_id: order.user_id, business_id: order.business_id });
}
