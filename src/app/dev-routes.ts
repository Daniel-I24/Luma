import type { Routes } from '@angular/router';

/**
 * Development-only routes (design system showcase). Production and deploy
 * builds replace this file with dev-routes.prod.ts (angular.json
 * fileReplacements), so neither the route nor its chunk is shipped.
 */
export const DEV_ONLY_ROUTES: Routes = [
  {
    path: 'design-preview',
    loadComponent: () =>
      import('./features/design-preview/design-preview').then((m) => m.DesignPreviewPage),
  },
];
