import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';
import { guestGuard } from '@core/auth/guest.guard';
import { DETAIL_ROUTE_DATA } from '@core/navigation/route-transition';
import { accountHomeGuard, accountReadyGuard, ownerChildGuard, ownerGuard } from '@shared/account/account.guards';
import { DEV_ONLY_ROUTES } from './dev-routes';


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
    canActivate: [authGuard, accountReadyGuard],
    loadComponent: () => import('./features/onboarding/welcome.page').then((m) => m.WelcomePage),
  },
  {
    // The signed Android APK (announced in /version.json): public.
    path: 'download',
    loadComponent: () => import('./features/download/download.page').then((m) => m.DownloadPage),
  },
  {
    // Frequent questions and the app version: public.
    path: 'help',
    loadComponent: () => import('./features/help/help.page').then((m) => m.HelpPage),
  },
  {
    path: 'account/password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account-password/account-password.page').then((m) => m.AccountPasswordPage),
  },
  {
    // Name, mobile and residence ("Completa tu perfil"); checkout links here.
    path: 'account/details',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account-details/account-details.page').then((m) => m.AccountDetailsPage),
  },
  {
    // The account type could not be read: "Reintentar", never a guess.
    path: 'account-error',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account-error/account-error.page').then((m) => m.AccountErrorPage),
  },
  {
    // Terms and privacy: public, linked from the sign-up and the Profile.
    path: 'legal',
    loadChildren: () => import('./features/legal/legal.routes').then((m) => m.legalRoutes),
  },
  // Design system showcase: development builds only (dev-routes.ts is empty in production and deploy builds).
  ...DEV_ONLY_ROUTES,
  {
    // Luma Negocios: business-owner accounts, with their own shell and tabs.
    path: 'owner',
    canActivate: [authGuard, ownerGuard],
    canActivateChild: [ownerChildGuard],
    loadChildren: () => import('./features/owner/owner.routes').then((m) => m.ownerRoutes),
  },
  {
    // Review team; adminRoutes also checks admin_access (MFA at /admin/mfa).
    path: 'admin',
    canActivate: [authGuard],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    // Signed-in sections share the tab bar layout.
    path: '',
    loadComponent: () => import('@shared/layout/tab-layout/tab-layout').then((m) => m.TabLayout),
    canActivate: [authGuard, accountReadyGuard],
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
        path: 'promotions',
        data: DETAIL_ROUTE_DATA,
        loadComponent: () =>
          import('./features/promotions/promotions.page').then((m) => m.PromotionsPage),
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
        path: 'orders/:id',
        data: DETAIL_ROUTE_DATA,
        loadComponent: () =>
          import('./features/orders/order-detail.page').then((m) => m.OrderDetailPage),
      },
    ],
  },
  {
    // Unknown addresses get a page with a way out (signed in or not).
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
