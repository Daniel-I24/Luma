import type { Routes } from '@angular/router';
import { DETAIL_ROUTE_DATA } from '@core/navigation/route-transition';

/** /business/** — the business panel (lazy; app.routes.ts guards it with authGuard). */
export const businessPanelRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/my-businesses/my-businesses.page').then((m) => m.MyBusinessesPage),
  },
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
    data: DETAIL_ROUTE_DATA,
    loadComponent: () =>
      import('./pages/business-dashboard/business-dashboard.page').then(
        (m) => m.BusinessDashboardPage,
      ),
  },
  {
    path: ':id/info',
    data: DETAIL_ROUTE_DATA,
    loadComponent: () =>
      import('./pages/business-info/business-info.page').then((m) => m.BusinessInfoPage),
  },
  {
    path: ':id/hours',
    data: DETAIL_ROUTE_DATA,
    loadComponent: () =>
      import('./pages/business-hours/business-hours.page').then((m) => m.BusinessHoursPage),
  },
  {
    path: ':id/menu',
    data: DETAIL_ROUTE_DATA,
    loadComponent: () =>
      import('./pages/business-menu/business-menu.page').then((m) => m.BusinessMenuPage),
  },
  {
    path: ':id/promotions',
    data: DETAIL_ROUTE_DATA,
    loadComponent: () =>
      import('./pages/business-promotions/business-promotions.page').then(
        (m) => m.BusinessPromotionsPage,
      ),
  },
];
