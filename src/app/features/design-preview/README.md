# Design preview

- **Route**: `/design-preview (development builds only)` (lazy).
- **What it does**: Showcase of the design-system components in every theme. Production builds replace dev-routes.ts, so this feature is never shipped.
- **Parts**: design-preview page and preview components.
- **Depends on**: design-system. Never on another feature (lint rule `luma/layer-boundaries`).
