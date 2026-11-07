/** A row of claim_push_batch or claim_push_retries (those carry their attempt). */
export interface PushRow {
  readonly notification_id: string;
  readonly type: string;
  readonly status: string | null;
  readonly order_id: string | null;
  readonly business_id: string | null;
  readonly business_name: string | null;
  readonly tokens: readonly string[];
  readonly attempt?: number;
}

export interface PushText {
  readonly title: string;
  readonly body: string;
}

/** Business names are public but third-party text: plain, short. */
export function cleanName(name: string | null): string {
  const clean = (name ?? '').replace(/[\p{Cc}\p{Cf}<>]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40).trim();
  return clean || 'Luma';
}

const ORDER_STATUS: Record<string, (b: string) => PushText> = {
  accepted: (b) => ({ title: 'Pedido aceptado', body: `${b} aceptó tu pedido.` }),
  preparing: (b) => ({ title: 'Preparando tu pedido', body: `${b} está preparando tu pedido.` }),
  ready: (b) => ({ title: 'Pedido listo', body: `Tu pedido en ${b} está listo para recoger.` }),
  picked_up: (b) => ({ title: 'Pedido entregado', body: `Gracias por pedir en ${b}.` }),
  cancelled: (b) => ({ title: 'Pedido cancelado', body: `${b} canceló tu pedido.` }),
};

const REVIEW: Record<string, (b: string) => PushText> = {
  approved: (b) => ({ title: 'Negocio aprobado', body: `${b} ya es visible en Luma.` }),
  rejected: (b) => ({ title: 'Revisión con cambios', body: `Revisa las notas del equipo para ${b}.` }),
  suspended: (b) => ({ title: 'Negocio suspendido', body: `${b} fue suspendido. Revisa las notas.` }),
};

const PAYMENT: Record<string, (b: string) => PushText> = {
  approved: (b) => ({ title: 'Pago aprobado', body: `Tu pago en ${b} fue aprobado. El negocio ya recibió tu pedido.` }),
  declined: (b) => ({ title: 'Pago rechazado', body: `Tu pago en ${b} no fue aprobado. Puedes intentarlo de nuevo.` }),
  error: (b) => ({ title: 'Pago no completado', body: `Hubo un problema con tu pago en ${b}. Puedes intentarlo de nuevo.` }),
  voided: (b) => ({ title: 'Pago anulado', body: `Tu pago en ${b} fue anulado.` }),
  refund_required: (b) => ({ title: 'Reembolso en proceso', body: `Tu pedido en ${b} se canceló. Vamos a devolverte el pago.` }),
  refunded: (b) => ({ title: 'Reembolso hecho', body: `Te devolvimos el pago de tu pedido en ${b}.` }),
  duplicate_charge: (b) => ({
    title: 'Cobro duplicado',
    body: `Detectamos un cobro duplicado de tu pedido en ${b}. Te lo devolveremos.`,
  }),
  // Sent to the admins: a payment is waiting to be refunded (Operaciones).
  refund_pending_admin: () => ({ title: 'Reembolso pendiente', body: 'Hay un reembolso pendiente de hacer.' }),
};

const CONTACT: Record<string, (b: string) => PushText> = {
  approved: (b) => ({ title: 'Contacto verificado', body: `Verificamos un contacto de ${b}: ya lo ven tus clientes.` }),
  rejected: (b) => ({ title: 'Contacto sin verificar', body: `No pudimos verificar un contacto de ${b}. Pide otro código.` }),
};

/**
 * Spanish text of a push (the server does not know the app language; the
 * in-app list stays translated). Never customer names or user-written text,
 * only the public business name. Null for unknown types or statuses.
 */
export function pushText(row: PushRow): PushText | null {
  const b = cleanName(row.business_name);
  switch (row.type) {
    case 'order_new':
      return { title: 'Nuevo pedido', body: `Tienes un pedido nuevo en ${b}.` };
    case 'order_cancelled':
      return { title: 'Pedido cancelado', body: `El cliente canceló un pedido en ${b}.` };
    case 'order_status':
      return ORDER_STATUS[row.status ?? '']?.(b) ?? null;
    case 'business_review':
      return REVIEW[row.status ?? '']?.(b) ?? null;
    case 'promotion':
      return { title: 'Nueva promoción', body: `${b} tiene una promoción nueva.` };
    case 'payment':
      return PAYMENT[row.status ?? '']?.(b) ?? null;
    case 'review_invite':
      return { title: '¿Qué tal tu pedido?', body: `Cuéntanos cómo te fue en ${b}.` };
    case 'contact_verification':
      return CONTACT[row.status ?? '']?.(b) ?? null;
    case 'test':
      return { title: 'Notificación de prueba', body: 'Todo funciona: así te avisaremos de tus pedidos.' };
    default:
      return null;
  }
}

/** Data for the app to open the right screen (ids only). */
export function pushData(row: PushRow): Record<string, string> {
  const data: Record<string, string> = { type: row.type, notification_id: row.notification_id };
  if (row.order_id) data.order_id = row.order_id;
  if (row.business_id) data.business_id = row.business_id;
  return data;
}

/** Android channels created by the app (PushChannels): users mute marketing apart from orders. */
const CHANNEL_ORDERS = 'orders';
const CHANNEL_PROMOTIONS = 'promotions';

/** Promotions go to their own channel; orders, payments and reviews to 'orders'. */
export function channelFor(type: string): string {
  return type === 'promotion' ? CHANNEL_PROMOTIONS : CHANNEL_ORDERS;
}
