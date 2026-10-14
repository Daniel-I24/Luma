import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';
import { guestGuard } from '@core/auth/guest.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'map',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'design-preview',
    loadComponent: () =>
      import('./features/design-preview/design-preview').then((m) => m.DesignPreviewPage),
  },
  {
    // Signed-in sections share the tab bar layout.
    path: '',
    loadComponent: () => import('@shared/layout/tab-layout/tab-layout').then((m) => m.TabLayout),
    canActivate: [authGuard],
    children: [
      {
        path: 'map',
        loadComponent: () => import('./features/map/map.page').then((m) => m.MapPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.page').then((m) => m.SettingsPage),
      },
    ],
  },
];
