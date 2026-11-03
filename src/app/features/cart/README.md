# Cart

- **Route**: `/cart` (lazy).
- **What it does**: Lines of one business, quantities, the paused-orders warning and a review of prices and availability before checkout.
- **Parts**: cart.page; state/cart-review.store; utils/cart-reviewer.
- **Depends on**: shared/cart. Never on another feature (lint rule `luma/layer-boundaries`).
