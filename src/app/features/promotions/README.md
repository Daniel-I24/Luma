# Promotions

- **Route**: `/promotions` (lazy).
- **What it does**: Current promotions with sort, minimum discount, category and "abierto ahora" filters.
- **Parts**: promotions.page; state/promotions.store; components/ (filters, list).
- **Depends on**: shared/promotions, shared/business. Never on another feature (lint rule `luma/layer-boundaries`).
