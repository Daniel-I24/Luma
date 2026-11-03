# Admin

- **Route**: `/admin, /admin/mfa, /admin/operations, /admin/businesses/:id` (lazy).
- **What it does**: Business review queue and decisions, reports, payment operations (void, refund mark, reconcile), customer strikes and the audit log. Every admin screen needs TOTP (aal2).
- **Parts**: admin.routes + admin.guard (adminGuard, adminMemberGuard); pages/ (queue, review, mfa, operations); state/ stores; services/ repositories; components/ (review flags, decision form, location preview).
- **Depends on**: shared/business/verification (AdminRepository), core/auth. Never on another feature (lint rule `luma/layer-boundaries`).
