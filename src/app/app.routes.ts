import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';
import { guestGuard } from '@core/auth/guest.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'map',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/map/map.page').then((m) => m.MapPage),
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
    redirectTo: 'map',
    pathMatch: 'full',
  },
];
