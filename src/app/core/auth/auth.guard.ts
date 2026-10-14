import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * authGuard — functional route guard.
 *
 * Waits for the initial session restore, then redirects unauthenticated
 * users to /auth/login.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ready;
  return auth.user() !== null ? true : router.createUrlTree(['/auth/login']);
};
