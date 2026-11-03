import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AuthErrors } from '@core/auth/auth-error';
import { EnvironmentCheck } from '@core/config/environment-check';
import { FunctionsFetchError } from '@supabase/supabase-js';
import { ConnectivityService } from './connectivity.service';

describe('ConnectivityService', () => {
  it('follows the browser online and offline events', () => {
    const service = TestBed.inject(ConnectivityService);
    window.dispatchEvent(new Event('offline'));
    expect(service.online()).toBe(false);

    window.dispatchEvent(new Event('online'));
    expect(service.online()).toBe(true);
  });
});

describe('network errors', () => {
  it('tell "no connection" apart from "service unavailable"', async () => {
    expect(AuthErrors.mapAuthError('Failed to fetch', false)).toBe('errors.offline');
    expect(AuthErrors.mapAuthError('Failed to fetch', true)).toBe('errors.serviceUnavailable');
    expect(await AuthErrors.mapDeleteAccountError(new FunctionsFetchError(new Error()), false)).toBe(
      'errors.offline',
    );
  });
});

describe('usesPlaceholderConfig', () => {
  it('spots the template values of environment.example.ts', () => {
    expect(
      EnvironmentCheck.usesPlaceholderConfig({
        supabase: { url: 'https://placeholder.supabase.co', anonKey: 'placeholder-anon-key' },
      }),
    ).toBe(true);
    expect(
      EnvironmentCheck.usesPlaceholderConfig({ supabase: { url: 'https://abc.supabase.co', anonKey: 'eyJ.x.y' } }),
    ).toBe(false);
  });
});
