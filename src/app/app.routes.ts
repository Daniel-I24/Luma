import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: 'design-preview',
    loadComponent: () =>
      import('./features/design-preview/design-preview').then(
        (m) => m.DesignPreviewPage,
      ),
  },
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },
];
