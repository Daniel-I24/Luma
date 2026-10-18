import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';
import { guestGuard } from '@core/auth/guest.guard';
import { DETAIL_ROUTE_DATA } from '@core/navigation/route-transition';
import { accountHomeGuard, ownerGuard } from '@shared/account/account.guards';

const DEV_ONLY_ROUTES: Routes = [
  {
    path: 'design-preview',
    loadComponent: () =>
      import('./features/design-preview/design-preview').then((m) => m.DesignPreviewPage),
  },
];

export const routes: Routes = [
  {
    // Each account type has its own home (customers: /map).
    path: '',
    pathMatch: 'full',
    canActivate: [authGuard, accountHomeGuard],
    children: [],
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    // Tutorial after signing in (once per version) and from the Profile.
    path: 'welcome',
    canActivate: [authGuard],
    loadComponent: () => import('./features/onboarding/welcome.page').then((m) => m.WelcomePage),
  },
  {
    // Terms and privacy: public, linked from the sign-up and the Profile.
    path: 'legal',
    loadChildren: () => import('./features/legal/legal.routes').then((m) => m.legalRoutes),
  },
  // Design system showcase: development builds only. The production build
  // defines ngDevMode as false, so the route and its chunk are dropped.
  ...(typeof ngDevMode === 'undefined' || ngDevMode ? DEV_ONLY_ROUTES : []),
  {
    // Review team; adminRoutes also checks am_i_admin.
    path: 'admin',
    canActivate: [authGuard],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.adminRoutes),
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
        path: 'favorites',
        loadComponent: () =>
          import('./features/favorites/favorites.page').then((m) => m.FavoritesPage),
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
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications.page').then((m) => m.NotificationsPage),
      },
      {
        path: 'business',
        canActivate: [authGuard, ownerGuard],
        loadChildren: () =>
          import('./features/business-panel/business-panel.routes').then(
            (m) => m.businessPanelRoutes,
          ),
      },
      {
        path: 'orders/:id',
        data: DETAIL_ROUTE_DATA,
        loadComponent: () =>
          import('./features/orders/order-detail.page').then((m) => m.OrderDetailPage),
      },
    ],
  },
  { path: '**', redirectTo: 'map' },
];
