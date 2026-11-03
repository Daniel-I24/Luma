# Luma Negocios (owner)

- **Route**: `/owner, /owner/new, /owner/:id/…` (lazy).
- **What it does**: Everything a business owner manages: setup wizard, summary and sales, order board with pause, menu (manual and by photo scan), promotions with Luma IA ideas, hours, gallery, information, legal data and verification.
- **Parts**: owner.routes + owner.guards; owner-shell; pages/; state/ stores; services/ repositories; components/; utils/ (order board, drafts, requirements, setup steps).
- **Depends on**: shared/business, shared/orders, shared/promotions, shared/media. Never on another feature (lint rule `luma/layer-boundaries`).
