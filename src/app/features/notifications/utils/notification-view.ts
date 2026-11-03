import { ownerPaths } from '@shared/account/owner-paths';
import {
  type AppNotification,
  OWNER_NOTIFICATION_TYPES,
} from '@shared/notifications/notification.repository';

/** NotificationView — text key and link of a notification. */
export class NotificationView {
  /** Translation key of the notification text, from its type and status only. */
  public static notificationKey(notification: Pick<AppNotification, 'type' | 'status'>): string {
    if (notification.type === 'order_new') return 'notifications.text.orderNew';
    if (notification.type === 'order_cancelled') return 'notifications.text.orderCancelled';
    if (notification.type === 'review_invite') return 'notifications.text.reviewInvite';
    if (notification.type === 'promotion') return 'notifications.text.promotion';
    if (notification.type === 'payment') return `notifications.text.payment.${notification.status ?? 'unknown'}`;
    if (notification.type === 'business_review') return `notifications.text.businessReview.${notification.status ?? 'unknown'}`;
    return `notifications.text.status.${notification.status ?? 'unknown'}`;
  }

  /** Where tapping it leads: the owner's board or the customer's order. */
  public static notificationLink(notification: AppNotification): string[] | null {
    if (OWNER_NOTIFICATION_TYPES.includes(notification.type)) {
      return notification.business_id
        ? ownerPaths.section(notification.business_id, 'orders')
        : ownerPaths.home();
    }
    // Sent to the admins: the refund is done from Operaciones.
    if (notification.type === 'payment' && notification.status === 'refund_pending_admin') return ['/admin', 'operations'];
    return NotificationView.customerLink(notification);
  }

  /** Customer notifications: the business, the owner panel or the order. */
  private static customerLink(notification: AppNotification): string[] | null {
    const { type, business_id: businessId, order_id: orderId } = notification;
    // Invitation to review and promotions open the business; review decisions the owner panel.
    if ((type === 'review_invite' || type === 'promotion') && businessId) return ['/businesses', businessId];
    if (type === 'business_review') return businessId ? ownerPaths.section(businessId, 'summary') : ownerPaths.home();
    return orderId ? ['/orders', orderId] : null;
  }
}

