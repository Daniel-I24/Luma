import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AdminRepository } from '@shared/business/verification/admin.repository';

/**
 * The review screens: admins who passed MFA (admin_access 'ok'). Admins at
 * aal1 go to /admin/mfa first. A UI convenience: every admin action is
 * checked again by the database (is_admin needs aal2).
 */
export const adminGuard: CanActivateFn = async () => {
  // inject() only works before the first await.
  const repo = inject(AdminRepository);
  const router = inject(Router);
  const access = await repo.access();
  if (access === 'ok') return true;
  return router.parseUrl(access === 'needs_mfa' ? '/admin/mfa' : '/profile');
};

/** /admin/mfa: a member of the review team who still has to pass MFA. */
export const adminMemberGuard: CanActivateFn = async () => {
  const repo = inject(AdminRepository);
  const router = inject(Router);
  const access = await repo.access();
  if (access === 'ok') return router.parseUrl('/admin');
  return access === 'needs_mfa' ? true : router.parseUrl('/profile');
};
