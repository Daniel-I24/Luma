import { Injectable, inject } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { Business } from '../models/business.model';
import type { BusinessContact } from '../models/business-contact';
import type { RepoResult } from './business.repository';
import { BusinessWriteErrors } from './business-write-error';
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
  public async listMine(): Promise<RepoResult<OwnedBusinessSummary[]>> {
    const userId = this.auth.user()?.id;
    if (!userId) return { data: null, errorKey: 'businessPanel.errors.loadFailed' };
    const { data, error } = await this.db
      .from('businesses')
      .select('id, name, category, is_active, owner_id')
      .eq('owner_id', userId)
      .order('created_at');
    if (error) return { data: null, errorKey: 'businessPanel.errors.loadFailed' };
    // The filter above is the rule; this second check keeps another owner's row out even if a query changes.
    const rows = (data as (OwnedBusinessSummary & { owner_id: string })[]).filter((row) => row.owner_id === userId);
    return { data: rows.map((row) => ({ id: row.id, name: row.name, category: row.category, is_active: row.is_active })), errorKey: null };
  }

  /** One of the user's businesses, or null when it is not theirs or does not exist. */
  public async getMine(id: string): Promise<RepoResult<Business | null>> {
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
  public async create(input: NewBusinessInput): Promise<RepoResult<string>> {
    const userId = this.auth.user()?.id;
    const parsed = newBusinessSchema.safeParse(input);
    if (!userId || !parsed.success) return { data: null, errorKey: INVALID };
    const { data, error } = await this.db
      .from('businesses')
      .insert({ ...parsed.data, owner_id: userId, is_active: false })
      .select('id')
      .single();
    if (error)
      return { data: null, errorKey: BusinessWriteErrors.mapWriteError(error, 'businessPanel.errors.saveFailed') };
    return { data: (data as { id: string }).id, errorKey: null };
  }

  /** Saves the information of an owned business. */
  public async updateInfo(id: string, input: BusinessInfoInput): Promise<RepoResult<true>> {
    const parsed = businessInfoSchema.safeParse(input);
    if (!parsed.success) return { data: null, errorKey: INVALID };
    const { error } = await this.mine(this.db.from('businesses').update(parsed.data).eq('id', id));
    if (error)
      return { data: null, errorKey: BusinessWriteErrors.mapWriteError(error, 'businessPanel.errors.saveFailed') };
    return { data: true, errorKey: null };
  }

  /** Public contact, already normalised by parseContact (the database checks it again). */
  public async updateContact(id: string, contact: BusinessContact): Promise<RepoResult<true>> {
    const { error } = await this.mine(this.db.from('businesses').update(contact).eq('id', id));
    if (error)
      return { data: null, errorKey: BusinessWriteErrors.mapWriteError(error, 'businessPanel.errors.saveFailed') };
    return { data: true, errorKey: null };
  }

  /** Sets the logo and/or cover URL (https only). */
  public async updateImages(id: string, input: BusinessImagesInput): Promise<RepoResult<true>> {
    const parsed = businessImagesSchema.safeParse(input);
    if (!parsed.success) return { data: null, errorKey: INVALID };
    const { error } = await this.mine(this.db.from('businesses').update(parsed.data).eq('id', id));
    if (error)
      return { data: null, errorKey: BusinessWriteErrors.mapWriteError(error, 'businessPanel.errors.saveFailed') };
    return { data: true, errorKey: null };
  }

  /** Publishes or unpublishes; the database refuses to publish an incomplete business. */
  public async setPublished(id: string, published: boolean): Promise<RepoResult<true>> {
    const { error } = await this.mine(this.db.from('businesses').update({ is_active: published }).eq('id', id));
    if (error)
      return { data: null, errorKey: BusinessWriteErrors.mapWriteError(error, 'businessPanel.errors.publishFailed') };
    return { data: true, errorKey: null };
  }

  /** Every panel write is also scoped to the signed-in owner (RLS enforces it too). */
  private mine<Q extends { eq(column: string, value: string): Q }>(query: Q): Q {
    return query.eq('owner_id', this.auth.user()?.id ?? '');
  }
}
