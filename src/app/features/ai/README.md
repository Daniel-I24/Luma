# Luma IA

- **Route**: `/ai` (lazy).
- **What it does**: Recommendations for a moment of the day: three businesses and, when possible, a combo that goes straight to the cart. Rules engine by default, remote engine with fallback.
- **Parts**: ai.page; state/ai.store; components/ (recommendation list, combo card).
- **Depends on**: shared/recommendations, shared/cart. Never on another feature (lint rule `luma/layer-boundaries`).
