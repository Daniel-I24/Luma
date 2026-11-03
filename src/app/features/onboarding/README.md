# Welcome

- **Route**: `/welcome` (lazy).
- **What it does**: the welcome screens the first time the app is opened on
  a device (`WelcomeTutorial`, per device). Settings → "Ver tutorial" shows
  the same screens over the current screen (`shared/tutorial/TutorialHost`).
- **Parts**: welcome.page; the slides live in `shared/tutorial/welcome-slides`.
- **Depends on**: shared/account, shared/tutorial. Never on another feature (lint rule `luma/layer-boundaries`).
