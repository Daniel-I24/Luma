/** A row of claim_push_batch. */
export interface PushRow {
  readonly notification_id: string;
  readonly type: string;
  readonly status: string | null;
  readonly order_id: string | null;
  readonly business_name: string | null;
  readonly tokens: readonly string[];
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
    default:
      return null;
  }
}

/** Data for the app to open the right screen (ids only). */
export function pushData(row: PushRow): Record<string, string> {
  const data: Record<string, string> = { type: row.type, notification_id: row.notification_id };
  if (row.order_id) data.order_id = row.order_id;
  return data;
}
