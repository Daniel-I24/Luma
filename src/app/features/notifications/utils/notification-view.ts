import { ownerPaths } from '@shared/account/owner-paths';
import {
  type AppNotification,
  OWNER_NOTIFICATION_TYPES,
} from '@shared/notifications/notification.repository';

/** Types whose text does not depend on the status. */
const FIXED_TEXT: Partial<Record<string, string>> = {
  order_new: 'orderNew',
  order_cancelled: 'orderCancelled',
  review_invite: 'reviewInvite',
  promotion: 'promotion',
  test: 'test',
};
/** Types with one text per status; order_status (and anything else) uses notifications.text.status. */
const BY_STATUS_TEXT: Partial<Record<string, string>> = {
  payment: 'payment',
  business_review: 'businessReview',
  contact_verification: 'contactVerification',
};

/** NotificationView — text key and link of a notification. */
export class NotificationView {
  /** Translation key of the notification text, from its type and status only. */
  public static notificationKey(notification: Pick<AppNotification, 'type' | 'status'>): string {
    const fixed = FIXED_TEXT[notification.type];
    if (fixed) return `notifications.text.${fixed}`;
    const group = BY_STATUS_TEXT[notification.type] ?? 'status';
    return `notifications.text.${group}.${notification.status ?? 'unknown'}`;
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
    if (type === 'contact_verification') return businessId ? ownerPaths.screen(businessId, 'contact') : ownerPaths.home();
    if (type === 'test') return null;
    return orderId ? ['/orders', orderId] : null;
  }
}

