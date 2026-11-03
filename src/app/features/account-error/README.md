# Account error

- **Route**: `/account-error` (lazy).
- **What it does**: Shown when the signed-in profile cannot be read, instead of guessing the account type; offers retry and sign-out.
- **Parts**: account-error.page.
- **Depends on**: shared/account (SessionProfileStore). Never on another feature (lint rule `luma/layer-boundaries`).
