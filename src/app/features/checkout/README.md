# Checkout

- **Route**: `/checkout` (lazy).
- **What it does**: Pick-up time, notes and payment method (pay at pick-up or online with Wompi); creates the order on the server, which computes the price.
- **Parts**: checkout.page; state/ (checkout, pickup schedule); utils/ (pickup slots and time).
- **Depends on**: shared/orders, shared/payments, shared/cart. Never on another feature (lint rule `luma/layer-boundaries`).
