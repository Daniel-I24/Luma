import { inject } from '@angular/core';
import { type CanActivateChildFn, type CanActivateFn, Router } from '@angular/router';
import { ACCOUNT_ERROR_PATH, OWNER_INVITE_PATH } from './account-type';
import { SessionProfileStore } from './session-profile.store';

/**
 * Only business-owner accounts (the business panel). A customer goes to the
 * invitation to register a business; an unreadable profile to the error
 * screen. The database enforces the same rule (who may create businesses)
 * and RLS keeps every panel read to the owner's rows.
 */
export const ownerGuard: CanActivateFn = async () => {
  const store = inject(SessionProfileStore);
  const router = inject(Router);
  await store.whenLoaded();
  if (store.isBusinessOwner()) return true;
  return router.parseUrl(store.failed() ? ACCOUNT_ERROR_PATH : OWNER_INVITE_PATH);
};

/**
 * The same check on every move inside /owner: the parent guard does not run
 * again between child routes, so an account that changed on this device
 * (sign-out, another sign-in) would otherwise stay in the panel.
 */
export const ownerChildGuard: CanActivateChildFn = (route, state) => ownerGuard(route, state);

/** Sends a signed-in user to the tutorial (once per version) or the home of their account type. */
export const accountHomeGuard: CanActivateFn = async () => {
  const store = inject(SessionProfileStore);
  const router = inject(Router);
  return router.parseUrl(await store.landingPath());
};

/**
 * Screens that depend on the account type: wait for the profile; when it
 * could not be read, go to the error screen instead of guessing.
 */
export const accountReadyGuard: CanActivateFn = async () => {
  const store = inject(SessionProfileStore);
  const router = inject(Router);
  await store.whenLoaded();
  return store.failed() ? router.parseUrl(ACCOUNT_ERROR_PATH) : true;
};
