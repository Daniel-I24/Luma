import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { TextRules } from '@core/validation/text-rules';
import { ZodRules } from '@core/validation/zod-rules';
import type { RepoResult } from '@shared/business/data/business.repository';

/** profiles_display_name_rule: 2 to 40 clean characters with a letter. */
export const MAX_DISPLAY_NAME_LENGTH = TextRules.displayName.maxLength;

/** Cleaned display name; empty means "no public name" (null). */
const displayNameSchema = ZodRules.optionalText(TextRules.displayName);

/**
 * ProfileRepository — the signed-in user's public display name (shown next
 * to their reviews). RLS limits reads/updates to the user's own row and the
 * column grant only allows writing display_name.
 */
@Injectable({ providedIn: 'root' })
export class ProfileRepository {
  private readonly db = inject(SupabaseService).client;

  /** The user's public display name. */
  public async getDisplayName(userId: string): Promise<RepoResult<string | null>> {
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
  public async updateDisplayName(userId: string, name: string): Promise<RepoResult<string | null>> {
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
