import type { Routes } from '@angular/router';
import { DETAIL_ROUTE_DATA } from '@core/navigation/route-transition';
import { ownerLandingGuard } from './owner.guards';
import { OwnerShell } from './owner-shell/owner-shell';

/**
 * /owner/** — Luma Negocios (lazy; app.routes.ts requires a session and a
 * business-owner account). Tabs live under /owner/:id.
 */
export const ownerRoutes: Routes = [
  {
    path: '',
    component: OwnerShell,
    children: [
      { path: '', pathMatch: 'full', canActivate: [ownerLandingGuard], children: [] },
      {
        path: 'new',
        data: DETAIL_ROUTE_DATA,
        loadComponent: () =>
          import('./pages/register-business/register-business.page').then(
            (m) => m.RegisterBusinessPage,
          ),
      },
      {
        path: ':id',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'summary' },
          {
            path: 'summary',
            loadComponent: () =>
              import('./pages/owner-summary/owner-summary.page').then((m) => m.OwnerSummaryPage),
          },
          {
            path: 'orders',
            loadComponent: () =>
              import('./pages/business-orders/business-orders.page').then(
                (m) => m.BusinessOrdersPage,
              ),
          },
          {
            path: 'menu',
            loadComponent: () =>
              import('./pages/business-menu/business-menu.page').then((m) => m.BusinessMenuPage),
          },
          {
            path: 'promotions',
            loadComponent: () =>
              import('./pages/business-promotions/business-promotions.page').then(
                (m) => m.BusinessPromotionsPage,
              ),
          },
          {
            path: 'business',
            loadComponent: () =>
              import('./pages/my-business/my-business.page').then((m) => m.MyBusinessPage),
          },
          {
            path: 'business/info',
            data: DETAIL_ROUTE_DATA,
            loadComponent: () =>
              import('./pages/business-info/business-info.page').then((m) => m.BusinessInfoPage),
          },
          {
            path: 'business/hours',
            data: DETAIL_ROUTE_DATA,
            loadComponent: () =>
              import('./pages/business-hours/business-hours.page').then((m) => m.BusinessHoursPage),
          },
          {
            path: 'business/verification',
            data: DETAIL_ROUTE_DATA,
            loadComponent: () =>
              import('./pages/business-verification/business-verification.page').then(
                (m) => m.BusinessVerificationPage,
              ),
          },
        ],
      },
    ],
  },
];
