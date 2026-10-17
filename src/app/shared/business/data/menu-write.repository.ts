import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { MenuItem } from '../models/menu.model';
import type { RepoResult } from './business.repository';
import { mapWriteError } from './business-write-error';
import { type MenuItemInput, menuItemSchema } from './business-write.schemas';

const INVALID = 'businessPanel.errors.invalidData';
const SAVE_FAILED = 'businessPanel.errors.saveFailed';

/**
 * MenuWriteRepository — creates, edits and deletes the menu items of the
 * user's business (RLS: owner only). Reads use MenuRepository.getMenu, which
 * returns unavailable items too for the owner.
 */
@Injectable({ providedIn: 'root' })
export class MenuWriteRepository {
  private readonly db = inject(SupabaseService).client;

  async create(businessId: string, input: MenuItemInput): Promise<RepoResult<MenuItem>> {
    const parsed = menuItemSchema.safeParse(input);
    if (!parsed.success) return { data: null, errorKey: INVALID };
    const { data, error } = await this.db
      .from('menu_items')
      .insert({ ...parsed.data, business_id: businessId })
      .select('*')
      .single();
    if (error) return { data: null, errorKey: mapWriteError(error, SAVE_FAILED) };
    return { data: data as MenuItem, errorKey: null };
  }

  async update(id: string, input: MenuItemInput): Promise<RepoResult<MenuItem>> {
    const parsed = menuItemSchema.safeParse(input);
    if (!parsed.success) return { data: null, errorKey: INVALID };
    const { data, error } = await this.db
      .from('menu_items')
      .update(parsed.data)
      .eq('id', id)
      .select('*')
      .single();
    if (error) return { data: null, errorKey: mapWriteError(error, SAVE_FAILED) };
    return { data: data as MenuItem, errorKey: null };
  }

  async setAvailable(id: string, available: boolean): Promise<RepoResult<true>> {
    const { error } = await this.db
      .from('menu_items')
      .update({ is_available: available })
      .eq('id', id);
    if (error) return { data: null, errorKey: mapWriteError(error, SAVE_FAILED) };
    return { data: true, errorKey: null };
  }

  async remove(id: string): Promise<RepoResult<true>> {
    const { error } = await this.db.from('menu_items').delete().eq('id', id);
    if (error)
      return { data: null, errorKey: mapWriteError(error, 'businessPanel.errors.deleteFailed') };
    return { data: true, errorKey: null };
  }
}
