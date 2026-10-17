import type { AppNotification } from '@shared/notifications/notification.repository';

/** Translation key of the notification text, from its type and status only. */
export function notificationKey(notification: Pick<AppNotification, 'type' | 'status'>): string {
  if (notification.type === 'order_new') return 'notifications.text.orderNew';
  return `notifications.text.status.${notification.status ?? 'unknown'}`;
}

/** Where tapping it leads: the owner's board or the customer's order. */
export function notificationLink(notification: AppNotification): string[] | null {
  if (notification.type === 'order_new') {
    return notification.business_id
      ? ['/business', notification.business_id, 'orders']
      : ['/business'];
  }
  return notification.order_id ? ['/orders', notification.order_id] : null;
}
