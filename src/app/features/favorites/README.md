# Favourites

- **Route**: `/favorites` (lazy).
- **What it does**: The user's favourite businesses with their current status.
- **Parts**: favorites.page; state/.
- **Depends on**: shared/favorites, shared/business. Never on another feature (lint rule `luma/layer-boundaries`).
