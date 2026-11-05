import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { EnvironmentCheck } from '@core/config/environment-check';
import { SupabaseService } from '@core/supabase/supabase.service';

/** Unit tests can never reach a real project. */
describe('hermetic tests', () => {
  it('use the placeholder environment, whatever environment.ts holds on this machine', () => {
    expect(EnvironmentCheck.usesPlaceholderConfig()).toBe(true);
  });

  it('get a Supabase client that makes no request and keeps no session', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { client } = TestBed.inject(SupabaseService);
    await client.rpc('admin_access');
    await client.from('businesses').select('*');
    await client.auth.getSession();
    await client.functions.invoke('recommend');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(Object.keys(localStorage).filter((key) => key.includes('auth-token'))).toEqual([]);
    fetchSpy.mockRestore();
  });
});
