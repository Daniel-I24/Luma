# Account data

- **Route**: `/account/data` (lazy).
- **What it does**: The right of access of Ley 1581 de 2012: says what it is for, shows a summary of the account (orders, favourites, reviews, notices) and offers the whole file as a second step.
- **Parts**: account-data.page, services/data-export.service, utils/data-report.
- **Depends on**: design-system, shared/format, core/supabase. Never on another feature (lint rule `luma/layer-boundaries`).
