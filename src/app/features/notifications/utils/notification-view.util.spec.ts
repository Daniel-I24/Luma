import { describe, expect, it } from 'vitest';
import type { AppNotification } from '@shared/notifications/notification.repository';
import { notificationKey, notificationLink } from './notification-view.util';

const notice = (overrides: Partial<AppNotification>): AppNotification => ({
  id: 'n1', type: 'order_status', order_id: 'o1', status: 'ready', created_at: '', read_at: null, business_id: 'b1',
  ...overrides,
});

describe('notification view', () => {
  it('builds the text from the type and status only', () => {
    expect(notificationKey(notice({ type: 'payment', status: 'approved' }))).toBe('notifications.text.payment.approved');
    expect(notificationKey(notice({ type: 'review_invite', status: null }))).toBe('notifications.text.reviewInvite');
    expect(notificationKey(notice({ type: 'business_review', status: 'rejected' }))).toBe('notifications.text.businessReview.rejected');
    expect(notificationKey(notice({ type: 'promotion', status: null }))).toBe('notifications.text.promotion');
    expect(notificationKey(notice({}))).toBe('notifications.text.status.ready');
  });

  it('opens the business to review, the panel for review decisions and the order for payments', () => {
    expect(notificationLink(notice({ type: 'review_invite' }))).toEqual(['/businesses', 'b1']);
    expect(notificationLink(notice({ type: 'promotion', order_id: null }))).toEqual(['/businesses', 'b1']);
    expect(notificationLink(notice({ type: 'business_review', order_id: null }))).toEqual(['/owner', 'b1', 'summary']);
    expect(notificationLink(notice({ type: 'payment', status: 'declined' }))).toEqual(['/orders', 'o1']);
    expect(notificationLink(notice({ type: 'order_new' }))).toEqual(['/owner', 'b1', 'orders']);
  });
});
