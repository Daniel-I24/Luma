import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { createFakeSupabase } from '../../../testing/fake-supabase';
import { AccountProfileRepository } from './account-profile.repository';

function repoAnswering(error: { message: string; code?: string }): AccountProfileRepository {
  const fake = createFakeSupabase({ profiles: { data: null, error } });
  TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: { client: fake.client } }] });
  return TestBed.inject(AccountProfileRepository);
}

describe('AccountProfileRepository', () => {
  it('a database without this version\'s migrations (missing column) is reported as outdated', async () => {
    const repo = repoAnswering({ message: 'column profiles.avatar_path does not exist', code: '42703' });
    expect(await repo.getMine('u1')).toEqual({ data: null, errorKey: 'accountError.outdated' });
  });

  it('any other failure stays a generic load error', async () => {
    const repo = repoAnswering({ message: 'boom', code: '500' });
    expect((await repo.getMine('u1')).errorKey).toBe('profile.errors.load');
  });
});
