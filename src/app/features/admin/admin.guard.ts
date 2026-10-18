import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AdminRepository } from '@shared/business/verification/admin.repository';

/**
 * Only the review team (am_i_admin). A UI convenience: every admin action is
 * checked again by the database (is_admin in the RPCs and policies).
 */
export const adminGuard: CanActivateFn = async () => {
  // inject() only works before the first await.
  const repo = inject(AdminRepository);
  const router = inject(Router);
  return (await repo.amIAdmin()) ? true : router.parseUrl('/profile');
};
