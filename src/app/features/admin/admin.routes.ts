import type { Routes } from '@angular/router';
import { DETAIL_ROUTE_DATA } from '@core/navigation/route-transition';
import { adminGuard } from './admin.guard';

/** /admin/** — the review team (lazy; app.routes.ts also requires a session). */
export const adminRoutes: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/admin-queue/admin-queue.page').then((m) => m.AdminQueuePage),
      },
      {
        path: 'businesses/:id',
        data: DETAIL_ROUTE_DATA,
        loadComponent: () =>
          import('./pages/admin-review/admin-review.page').then((m) => m.AdminReviewPage),
      },
    ],
  },
];
