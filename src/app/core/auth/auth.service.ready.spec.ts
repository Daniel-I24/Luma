import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { AuthService } from './auth.service';
import { SupabaseService } from '@core/supabase/supabase.service';

function setup(getSession: () => Promise<unknown>): AuthService {
  TestBed.configureTestingModule({
    providers: [
      AuthService,
      {
        provide: SupabaseService,
        useValue: {
          client: { auth: { getSession, onAuthStateChange: vi.fn() } },
        },
      },
    ],
  });
  return TestBed.inject(AuthService);
}

describe('AuthService.ready', () => {
  it('resolves with the restored session user', async () => {
    const user = { id: 'user-1' };
    const service = setup(() => Promise.resolve({ data: { session: { user } }, error: null }));

    expect(service.user()).toBeNull();
    await service.ready;

    expect(service.user()).toEqual(user);
  });

  it('resolves without a user when there is no stored session', async () => {
    const service = setup(() => Promise.resolve({ data: { session: null }, error: null }));

    await service.ready;

    expect(service.user()).toBeNull();
  });

  it('resolves without a user when Supabase returns an error', async () => {
    const service = setup(() =>
      Promise.resolve({ data: { session: null }, error: { message: 'boom' } }),
    );

    await service.ready;

    expect(service.user()).toBeNull();
  });

  it('resolves without a user when session restore throws', async () => {
    const service = setup(() => Promise.reject(new Error('network')));

    await expect(service.ready).resolves.toBeUndefined();
    expect(service.user()).toBeNull();
  });
});
