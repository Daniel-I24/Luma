# Change password

- **Route**: `/account/password` (lazy).
- **What it does**: Changes the password after re-checking the current one.
- **Parts**: account-password.page.
- **Depends on**: core/auth (PasswordChangeService). Never on another feature (lint rule `luma/layer-boundaries`).
