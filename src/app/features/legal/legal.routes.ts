import type { Routes } from '@angular/router';

const page = () => import('./legal-document.page').then((m) => m.LegalDocumentPage);

/** /legal/** — public: readable before signing up. */
export const legalRoutes: Routes = [
  { path: 'terms', data: { document: 'terms' }, loadComponent: page },
  { path: 'privacy', data: { document: 'privacy' }, loadComponent: page },
  { path: '', redirectTo: 'terms', pathMatch: 'full' },
];
