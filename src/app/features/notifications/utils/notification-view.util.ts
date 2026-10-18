import { ownerPaths } from '@shared/account/owner-paths';
import {
  type AppNotification,
  OWNER_NOTIFICATION_TYPES,
} from '@shared/notifications/notification.repository';

/** Translation key of the notification text, from its type and status only. */
export function notificationKey(notification: Pick<AppNotification, 'type' | 'status'>): string {
  if (notification.type === 'order_new') return 'notifications.text.orderNew';
  if (notification.type === 'order_cancelled') return 'notifications.text.orderCancelled';
  return `notifications.text.status.${notification.status ?? 'unknown'}`;
}

/** Where tapping it leads: the owner's board or the customer's order. */
export function notificationLink(notification: AppNotification): string[] | null {
  if (OWNER_NOTIFICATION_TYPES.includes(notification.type)) {
    return notification.business_id
      ? ownerPaths.section(notification.business_id, 'orders')
      : ownerPaths.home();
  }
  return notification.order_id ? ['/orders', notification.order_id] : null;
}
