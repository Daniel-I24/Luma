import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { SessionProfileStore } from './session-profile.store';

/**
 * Only business-owner accounts (the business panel). Others go to their
 * home. The database enforces the same rule (who may create businesses).
 */
export const ownerGuard: CanActivateFn = async () => {
  const store = inject(SessionProfileStore);
  const router = inject(Router);
  await store.whenLoaded();
  return store.isBusinessOwner() ? true : router.parseUrl(await store.homePath());
};

/** Sends a signed-in user to the home of their account type. */
export const accountHomeGuard: CanActivateFn = async () => {
  const store = inject(SessionProfileStore);
  return inject(Router).parseUrl(await store.homePath());
};
