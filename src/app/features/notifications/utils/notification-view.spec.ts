import { describe, expect, it } from 'vitest';
import type { AppNotification } from '@shared/notifications/notification.repository';
import { NotificationView } from './notification-view';

const notice = (overrides: Partial<AppNotification>): AppNotification => ({
  id: 'n1', type: 'order_status', order_id: 'o1', status: 'ready', created_at: '', read_at: null, business_id: 'b1',
  ...overrides,
});

describe('notification view', () => {
  it('builds the text from the type and status only', () => {
    expect(NotificationView.notificationKey(notice({ type: 'payment', status: 'approved' }))).toBe('notifications.text.payment.approved');
    expect(NotificationView.notificationKey(notice({ type: 'review_invite', status: null }))).toBe('notifications.text.reviewInvite');
    expect(NotificationView.notificationKey(notice({ type: 'business_review', status: 'rejected' }))).toBe('notifications.text.businessReview.rejected');
    expect(NotificationView.notificationKey(notice({ type: 'promotion', status: null }))).toBe('notifications.text.promotion');
    expect(NotificationView.notificationKey(notice({ type: 'test', status: null }))).toBe('notifications.text.test');
    expect(NotificationView.notificationKey(notice({ type: 'contact_verification', status: 'approved' }))).toBe('notifications.text.contactVerification.approved');
    expect(NotificationView.notificationKey(notice({}))).toBe('notifications.text.status.ready');
  });

  it('opens the business to review, the panel for review decisions and the order for payments', () => {
    expect(NotificationView.notificationLink(notice({ type: 'review_invite' }))).toEqual(['/businesses', 'b1']);
    expect(NotificationView.notificationLink(notice({ type: 'promotion', order_id: null }))).toEqual(['/businesses', 'b1']);
    expect(NotificationView.notificationLink(notice({ type: 'business_review', order_id: null }))).toEqual(['/owner', 'b1', 'summary']);
    expect(NotificationView.notificationLink(notice({ type: 'payment', status: 'declined' }))).toEqual(['/orders', 'o1']);
    expect(NotificationView.notificationLink(notice({ type: 'order_new' }))).toEqual(['/owner', 'b1', 'orders']);
    expect(NotificationView.notificationLink(notice({ type: 'payment', status: 'refund_pending_admin' }))).toEqual(['/admin', 'operations']);
    expect(NotificationView.notificationKey(notice({ type: 'payment', status: 'duplicate_charge' }))).toBe('notifications.text.payment.duplicate_charge');
  });

  it('contacts: the owner hears of the decision on their contact screen; the admins of a request in their queue', () => {
    expect(NotificationView.notificationLink(notice({ type: 'contact_verification', status: 'rejected' }))).toEqual(['/owner', 'b1', 'business', 'contact']);
    expect(NotificationView.notificationLink(notice({ type: 'contact_verification', status: 'contact_requested' }))).toEqual(['/admin']);
    expect(NotificationView.notificationKey(notice({ type: 'contact_verification', status: 'contact_requested' })))
      .toBe('notifications.text.contactVerification.contact_requested');
  });
});
