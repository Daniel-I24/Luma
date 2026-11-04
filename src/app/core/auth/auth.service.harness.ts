import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from './auth.service';
import { SupabaseService } from '@core/supabase/supabase.service';

/** Creates a minimal SupabaseService stub with controllable auth responses. */
function makeSupabaseStub(overrides: Record<string, unknown> = {}) {
  return {
    client: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi
          .fn()
          .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        ...overrides,
      },
      functions: {
        invoke: vi.fn(),
      },
    },
  };
}

/** What the AuthService specs share: their mocks, set-up and helpers. */
export function authServiceHarness() {

  function setup(authOverrides: Record<string, unknown> = {}) {
    h.supabaseStub = makeSupabaseStub(authOverrides);
    TestBed.configureTestingModule({
      providers: [AuthService, { provide: SupabaseService, useValue: h.supabaseStub }],
    });
    h.service = TestBed.inject(AuthService);
  }

  const h = {
    setup,
    service: undefined as unknown as AuthService,
    supabaseStub: undefined as unknown as ReturnType<typeof makeSupabaseStub>,
  };
  return h;
}
