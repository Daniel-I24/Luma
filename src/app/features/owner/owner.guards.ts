import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { ownerPaths } from '@shared/account/owner-paths';
import { OwnerContextStore } from './state/owner-context.store';

/**
 * /owner lands on the summary of the last business shown (or the first),
 * or on the registration when the owner has none yet. When the list cannot
 * be read, the summary route of nothing is avoided: the shell shows the error.
 */
export const ownerLandingGuard: CanActivateFn = async () => {
  const context = inject(OwnerContextStore);
  const router = inject(Router);
  const businesses = await context.load();
  if (businesses === null) return true;
  const id = context.landingId();
  return router.createUrlTree(id ? ownerPaths.section(id, 'summary') : ownerPaths.register());
};
