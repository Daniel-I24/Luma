# Business profile

- **Route**: `/businesses/:id` (lazy).
- **What it does**: Public profile of a business: hero, menu with add-to-cart, promotions, information and hours, gallery, contact and reviews; report a business.
- **Parts**: business-profile.page; state/ (profile and reviews stores); components/ (hero, tabs, menu, info, reviews, report sheet).
- **Depends on**: shared/business, shared/cart, shared/favorites. Never on another feature (lint rule `luma/layer-boundaries`).
