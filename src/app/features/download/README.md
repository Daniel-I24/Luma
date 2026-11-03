# Download

- **Route**: `/download` (lazy).
- **What it does**: Latest signed Android APK from /version.json of the same site.
- **Parts**: download.page; release.repository.
- **Depends on**: core/config. Never on another feature (lint rule `luma/layer-boundaries`).
