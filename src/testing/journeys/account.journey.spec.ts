import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthCodeService } from '@core/auth/auth-code.service';
import { AuthService } from '@core/auth/auth.service';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { ACCOUNT_ERROR_PATH } from '@shared/account/account-homes';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { createFakeSupabase, failure, ok } from '../fake-supabase';

/**
 * Journey of the phone findings 1-3: the sign-up is confirmed with a code,
 * an unconfirmed email never gets in, and an unreadable profile shows the
 * error screen (never the customer screens) until "Reintentar" works.
 * Real AuthService, AuthCodeService, SessionProfileStore and repository;
 * only the Supabase client is fake.
 */
describe('journey: register a business owner on a phone', () => {
  type Listener = (event: string, session: unknown) => void;
  let listener: Listener = () => undefined;
  const confirmed = { user: { id: 'u1', email_confirmed_at: '2026-10-19T10:00:00Z' } };
  const unconfirmed = { user: { id: 'u1', email_confirmed_at: null } };
  const owner = { account_type: 'business_owner', display_name: null, full_name: 'Ana', phone: null, onboarding_seen_version: 99 };
  let profiles = failure('relation "profiles" has no column account_type');

  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn((cb: Listener) => void (listener = cb)),
    signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn(async () => {
      listener('SIGNED_IN', confirmed);
      return { error: null };
    }),
  };

  beforeEach(() => {
    const fake = createFakeSupabase();
    const client = {
      ...fake.client,
      auth,
      from: (table: string) => {
        const query = fake.client.from(table);
        return table === 'profiles' ? Object.assign(query, { then: (f: (v: unknown) => unknown) => Promise.resolve(profiles).then(f) }) : query;
      },
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: { client } },
        { provide: ConnectivityService, useValue: { online: signal(true) } },
      ],
    });
  });

  it('signs up, is refused before confirming, confirms with the code and never sees customer screens', async () => {
    const service = TestBed.inject(AuthService);
    const codes = TestBed.inject(AuthCodeService);
    const store = TestBed.inject(SessionProfileStore);
    await service.ready;

    expect((await service.signUp('ana@example.com', 'Una-clave-larga-9')).success).toBe(true);

    // Finding 3: a project that hands out sessions to unconfirmed emails is not enough.
    auth.signInWithPassword.mockResolvedValue({ data: { session: unconfirmed }, error: null });
    expect(await service.signIn('ana@example.com', 'Una-clave-larga-9')).toEqual({
      success: false,
      errorKey: 'auth.errors.emailNotConfirmed',
    });
    expect(service.user()).toBeNull();

    // Finding 1: the 6-digit code (never a link) confirms the account.
    expect((await codes.confirmSignup('ana@example.com', '123456')).success).toBe(true);
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'ana@example.com', token: '123456', type: 'signup' });
    expect(service.user()?.id).toBe('u1');
    TestBed.tick();

    // Finding 2: the profile cannot be read (migrations missing) -> error screen.
    await store.whenLoaded();
    expect(await store.landingPath()).toBe(ACCOUNT_ERROR_PATH);

    // The database is fixed: "Reintentar" lands on Luma Negocios.
    profiles = ok(owner);
    expect(await store.retry()).toBe(true);
    expect(await store.landingPath()).toBe('/owner');
  });
});
