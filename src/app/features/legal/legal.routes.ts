import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

const page = (): Promise<Type<unknown>> => import('./legal-document.page').then((m) => m.LegalDocumentPage);

/** /legal/** — public: readable before signing up. */
export const legalRoutes: Routes = [
  { path: 'terms', data: { document: 'terms' }, loadComponent: page },
  { path: 'privacy', data: { document: 'privacy' }, loadComponent: page },
  { path: 'refunds', data: { document: 'refunds' }, loadComponent: page },
  { path: '', redirectTo: 'terms', pathMatch: 'full' },
];
