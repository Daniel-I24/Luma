import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { createFakeSupabase, failure, ok } from '../../../testing/fake-supabase';
import type { FakeResponse } from '../../../testing/fake-supabase';
import { ProfileRepository } from './profile.repository';

function setup(response: FakeResponse = ok(null)) {
  const fake = createFakeSupabase({ profiles: response });
  TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: fake }] });
  return { repo: TestBed.inject(ProfileRepository), queries: fake.queries };
}

describe('ProfileRepository', () => {
  it("reads only the user's display name, never other profile columns", async () => {
    const { repo, queries } = setup(ok({ display_name: 'Ana M.' }));

    expect(await repo.getDisplayName('u1')).toEqual({ data: 'Ana M.', errorKey: null });
    expect(queries[0].call('select')).toEqual(['display_name']);
    expect(queries[0].call('eq')).toEqual(['id', 'u1']);
  });

  it('saves a trimmed display name and sends nothing else', async () => {
    const { repo, queries } = setup();

    expect(await repo.updateDisplayName('u1', '  Ana M.  ')).toEqual({
      data: 'Ana M.',
      errorKey: null,
    });
    expect(queries[0].call('update')).toEqual([{ display_name: 'Ana M.' }]);
  });

  it('clears the display name when left empty', async () => {
    const { repo, queries } = setup();

    expect((await repo.updateDisplayName('u1', '   ')).data).toBeNull();
    expect(queries[0].call('update')).toEqual([{ display_name: null }]);
  });

  it('rejects names over 40 characters before calling the server', async () => {
    const { repo, queries } = setup();

    expect((await repo.updateDisplayName('u1', 'a'.repeat(41))).errorKey).toBe(
      'profile.validation.displayNameTooLong',
    );
    expect(queries).toHaveLength(0);
  });

  it('maps Supabase errors to i18n keys', async () => {
    const { repo } = setup(failure());

    expect((await repo.getDisplayName('u1')).errorKey).toBe('profile.errors.displayNameLoad');
    expect((await repo.updateDisplayName('u1', 'Ana')).errorKey).toBe(
      'profile.errors.displayNameSave',
    );
  });
});
