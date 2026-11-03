# Notifications

- **Route**: `/notifications` (lazy).
- **What it does**: The user's notifications (orders, promotions, reviews) with links to what they refer to.
- **Parts**: notifications.page; state/; utils/notification-view.
- **Depends on**: shared/notifications. Never on another feature (lint rule `luma/layer-boundaries`).
