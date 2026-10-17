import { Injectable, inject } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { Business } from '../models/business.model';
import type { RepoResult } from './business.repository';
import { mapWriteError } from './business-write-error';
import {
  type BusinessImagesInput,
  type BusinessInfoInput,
  type NewBusinessInput,
  businessImagesSchema,
  businessInfoSchema,
  newBusinessSchema,
} from './business-write.schemas';

/** What the panel lists for each of the user's businesses. */
export type OwnedBusinessSummary = Pick<Business, 'id' | 'name' | 'category' | 'is_active'>;

const INVALID = 'businessPanel.errors.invalidData';

/**
 * OwnedBusinessRepository — the signed-in user's own businesses: list,
 * register (always unpublished), edit and publish. Inputs are validated
 * with the same limits as the database; RLS limits every write to the
 * owner and a trigger enforces the publishing requirements.
 */
@Injectable({ providedIn: 'root' })
export class OwnedBusinessRepository {
  private readonly db = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  /** The user's businesses, published or not, oldest first. */
  async listMine(): Promise<RepoResult<OwnedBusinessSummary[]>> {
    const userId = this.auth.user()?.id;
    if (!userId) return { data: null, errorKey: 'businessPanel.errors.loadFailed' };
    const { data, error } = await this.db
      .from('businesses')
      .select('id, name, category, is_active')
      .eq('owner_id', userId)
      .order('created_at');
    if (error) return { data: null, errorKey: 'businessPanel.errors.loadFailed' };
    return { data: data as OwnedBusinessSummary[], errorKey: null };
  }

  /** One of the user's businesses, or null when it is not theirs or does not exist. */
  async getMine(id: string): Promise<RepoResult<Business | null>> {
    const userId = this.auth.user()?.id;
    if (!userId) return { data: null, errorKey: 'businessPanel.errors.loadFailed' };
    const { data, error } = await this.db
      .from('businesses')
      .select('*')
      .eq('id', id)
      .eq('owner_id', userId)
      .maybeSingle();
    if (error) return { data: null, errorKey: 'businessPanel.errors.loadFailed' };
    return { data: data as Business | null, errorKey: null };
  }

  /** Registers an unpublished business; resolves to its id. */
  async create(input: NewBusinessInput): Promise<RepoResult<string>> {
    const userId = this.auth.user()?.id;
    const parsed = newBusinessSchema.safeParse(input);
    if (!userId || !parsed.success) return { data: null, errorKey: INVALID };
    const { data, error } = await this.db
      .from('businesses')
      .insert({ ...parsed.data, owner_id: userId, is_active: false })
      .select('id')
      .single();
    if (error)
      return { data: null, errorKey: mapWriteError(error, 'businessPanel.errors.saveFailed') };
    return { data: (data as { id: string }).id, errorKey: null };
  }

  async updateInfo(id: string, input: BusinessInfoInput): Promise<RepoResult<true>> {
    const parsed = businessInfoSchema.safeParse(input);
    if (!parsed.success) return { data: null, errorKey: INVALID };
    const { error } = await this.db.from('businesses').update(parsed.data).eq('id', id);
    if (error)
      return { data: null, errorKey: mapWriteError(error, 'businessPanel.errors.saveFailed') };
    return { data: true, errorKey: null };
  }

  /** Sets the logo and/or cover URL (https only). */
  async updateImages(id: string, input: BusinessImagesInput): Promise<RepoResult<true>> {
    const parsed = businessImagesSchema.safeParse(input);
    if (!parsed.success) return { data: null, errorKey: INVALID };
    const { error } = await this.db.from('businesses').update(parsed.data).eq('id', id);
    if (error)
      return { data: null, errorKey: mapWriteError(error, 'businessPanel.errors.saveFailed') };
    return { data: true, errorKey: null };
  }

  /** Publishes or unpublishes; the database refuses to publish an incomplete business. */
  async setPublished(id: string, published: boolean): Promise<RepoResult<true>> {
    const { error } = await this.db
      .from('businesses')
      .update({ is_active: published })
      .eq('id', id);
    if (error)
      return { data: null, errorKey: mapWriteError(error, 'businessPanel.errors.publishFailed') };
    return { data: true, errorKey: null };
  }
}
