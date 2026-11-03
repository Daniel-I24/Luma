# Map

- **Route**: `/map` (lazy).
- **What it does**: Live MapLibre map with business markers, filters, place search, the nearby list and the business sheet. The map is created on entry and removed on exit.
- **Parts**: map.page; services/ (camera, markers, hours cache); state/ (nearby businesses, selection, place search); utils/ (filters, zone label); components/.
- **Depends on**: shared/map, shared/geo, shared/business. Never on another feature (lint rule `luma/layer-boundaries`).
