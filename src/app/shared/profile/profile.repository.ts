import { Injectable, inject } from '@angular/core';
import * as z from 'zod/mini';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RepoResult } from '@shared/business/data/business.repository';

/** Mirrors the CHECK constraint of profiles.display_name. */
export const MAX_DISPLAY_NAME_LENGTH = 40;

/** Trimmed display name; empty means "no public name" (null). */
const displayNameSchema = z.pipe(
  z
    .string()
    .check(z.trim(), z.maxLength(MAX_DISPLAY_NAME_LENGTH, 'profile.validation.displayNameTooLong')),
  z.transform((name) => (name ? name : null)),
);

/**
 * ProfileRepository — the signed-in user's public display name (shown next
 * to their reviews). RLS limits reads/updates to the user's own row and the
 * column grant only allows writing display_name.
 */
@Injectable({ providedIn: 'root' })
export class ProfileRepository {
  private readonly db = inject(SupabaseService).client;

  async getDisplayName(userId: string): Promise<RepoResult<string | null>> {
    const { data, error } = await this.db
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();

    if (error) return { data: null, errorKey: 'profile.errors.displayNameLoad' };
    return {
      data: (data as { display_name: string | null } | null)?.display_name ?? null,
      errorKey: null,
    };
  }

  /** Saves the display name; returns the stored value (null when cleared). */
  async updateDisplayName(userId: string, name: string): Promise<RepoResult<string | null>> {
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) return { data: null, errorKey: parsed.error.issues[0].message };

    const { error } = await this.db
      .from('profiles')
      .update({ display_name: parsed.data })
      .eq('id', userId);

    if (error) return { data: null, errorKey: 'profile.errors.displayNameSave' };
    return { data: parsed.data, errorKey: null };
  }
}
