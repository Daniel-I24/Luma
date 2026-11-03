# Mis datos

- **Route**: `/account/details` (lazy).
- **What it does**: Full name, mobile, residence (DANE catalogue) and the optional profile photo with consent and the "show to businesses" switch.
- **Parts**: account-details.page (form), account-details.store (load/save through AccountProfileRepository), avatar-settings + avatar-settings.store (photo in private Storage, signed URLs).
- **Depends on**: shared/account, shared/geo (ResidencePicker), shared/media. Never on another feature (lint rule `luma/layer-boundaries`).
