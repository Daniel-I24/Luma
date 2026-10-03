import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * authGuard — functional route guard.
 *
 * Redirects unauthenticated users to /auth/login.
 * Uses the AuthService signal so no async call is needed after init.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.user() !== null) {
    return true;
  }

  return router.createUrlTree(['/auth/login']);
};
