import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AdminRepository } from '@shared/business/verification/admin.repository';
import { adminGuard } from './admin.guard';

async function run(isAdmin: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AdminRepository, useValue: { amIAdmin: vi.fn().mockResolvedValue(isAdmin) } },
    ],
  });
  return TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
}

describe('adminGuard', () => {
  it('lets admins in', async () => {
    expect(await run(true)).toBe(true);
  });

  it('sends everyone else to their profile', async () => {
    const result = await run(false);

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/profile');
  });
});
