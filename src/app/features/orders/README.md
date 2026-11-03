# Orders

- **Route**: `/orders, /orders/:id` (lazy).
- **What it does**: The customer's orders, the order detail with its timeline, estimate, directions, cancellation, payment state and "Pedir de nuevo".
- **Parts**: orders.page, order-detail.page; state/ (detail, payment); services/reorder; components/ (timeline, payment); utils/order-detail-view.
- **Depends on**: shared/orders, shared/payments, shared/cart. Never on another feature (lint rule `luma/layer-boundaries`).
