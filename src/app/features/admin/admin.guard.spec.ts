import { TestBed } from '@angular/core/testing';
import { type CanActivateFn, Router, UrlTree, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { type AdminAccess, AdminRepository } from '@shared/business/verification/admin.repository';
import { adminGuard, adminMemberGuard } from './admin.guard';

async function run(guard: CanActivateFn, access: AdminAccess): Promise<true | string> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AdminRepository, useValue: { access: vi.fn().mockResolvedValue(access) } },
    ],
  });
  const result = await TestBed.runInInjectionContext(() => guard({} as never, {} as never));
  return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : (result as true);
}

describe('adminGuard', () => {
  it('lets admins who passed MFA in', async () => {
    expect(await run(adminGuard, 'ok')).toBe(true);
  });

  it('sends admins without MFA to the code screen and everyone else to their profile', async () => {
    expect(await run(adminGuard, 'needs_mfa')).toBe('/admin/mfa');
  });

  it('never lets a non-admin in', async () => {
    expect(await run(adminGuard, 'none')).toBe('/profile');
  });
});

describe('adminMemberGuard', () => {
  it('opens the code screen only for admins who still need MFA', async () => {
    expect(await run(adminMemberGuard, 'needs_mfa')).toBe(true);
  });

  it('skips it once MFA is done and refuses non-admins', async () => {
    expect(await run(adminMemberGuard, 'ok')).toBe('/admin');
  });

  it('refuses non-admins', async () => {
    expect(await run(adminMemberGuard, 'none')).toBe('/profile');
  });
});
