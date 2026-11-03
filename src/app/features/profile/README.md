# Profile

- **Route**: `/profile` (lazy).
- **What it does**: Display name, activity links, becoming a business, notification settings, trust status, help links, sign-out and account deletion.
- **Parts**: profile.page; components/; services/.
- **Depends on**: shared/account, shared/notifications, shared/profile. Never on another feature (lint rule `luma/layer-boundaries`).
