# Discover

- **Route**: `/feed` (lazy).
- **What it does**: Vertical feed of promotions and dishes of nearby businesses, interleaved and paginated by distance.
- **Parts**: feed.page; state/feed.store; utils/feed-cards; components/ (cards); models/.
- **Depends on**: shared/business, shared/geo, shared/cart. Never on another feature (lint rule `luma/layer-boundaries`).
