import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';
import { guestGuard } from '@core/auth/guest.guard';
import { DETAIL_ROUTE_DATA } from '@core/navigation/route-transition';

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
        path: 'businesses/:id',
        data: DETAIL_ROUTE_DATA,
        loadComponent: () =>
          import('./features/business-profile/business-profile.page').then(
            (m) => m.BusinessProfilePage,
          ),
      },
      {
        path: 'feed',
        loadComponent: () => import('./features/feed/feed.page').then((m) => m.FeedPage),
      },
      {
        path: 'ai',
        loadComponent: () => import('./features/ai/ai.page').then((m) => m.AiPage),
      },
      {
        path: 'cart',
        loadComponent: () => import('./features/cart/cart.page').then((m) => m.CartPage),
      },
      {
        path: 'checkout',
        loadComponent: () =>
          import('./features/checkout/checkout.page').then((m) => m.CheckoutPage),
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/orders/orders.page').then((m) => m.OrdersPage),
      },
    ],
  },
];
