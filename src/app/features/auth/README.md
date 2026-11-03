# Authentication

- **Route**: `/auth/login, /auth/register, /auth/verify, /auth/forgot-password` (lazy).
- **What it does**: Sign-in, the six-step sign-up (account type, credentials, details, residence, optional photo, consent), the 6-digit e-mail code and password reset.
- **Parts**: auth.routes; pages/; signup/ (steps, validation, draft store, SignupCompletion); forms/ (AuthFormSubmission).
- **Depends on**: core/auth, shared/geo, shared/media. Never on another feature (lint rule `luma/layer-boundaries`).
