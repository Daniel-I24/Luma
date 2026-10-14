import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * guestGuard — functional route guard for the /auth/* pages.
 *
 * Waits for the initial session restore, then redirects authenticated
 * users to /map.
 */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ready;
  return auth.user() === null ? true : router.createUrlTree(['/map']);
};
