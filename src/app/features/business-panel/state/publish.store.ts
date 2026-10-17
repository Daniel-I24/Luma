import { Injectable, computed, inject, signal } from '@angular/core';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import type { BusinessHours } from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';
import { missingRequirements } from '../utils/publish-requirements.util';
import { PanelBusinessStore } from './panel-business.store';

/**
 * PublishStore — the publishing checklist of the managed business (its
 * hours and menu) and publishing / unpublishing it.
 */
@Injectable()
export class PublishStore {
  private readonly panel = inject(PanelBusinessStore);
  private readonly owned = inject(OwnedBusinessRepository);
  private readonly businesses = inject(BusinessRepository);
  private readonly menus = inject(MenuRepository);

  private readonly hours = signal<readonly BusinessHours[]>([]);
  private readonly items = signal<readonly MenuItem[]>([]);
  private readonly _busy = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  readonly busy = this._busy.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();

  readonly missing = computed(() => {
    const business = this.panel.business();
    return business ? missingRequirements(business, this.hours(), this.items()) : [];
  });

  async load(id: string): Promise<void> {
    const [hours, items] = await Promise.all([
      this.businesses.getHours(id),
      this.menus.getMenu(id),
    ]);
    this.hours.set(hours.data ?? []);
    this.items.set(items.data ?? []);
    this._errorKey.set(hours.errorKey ?? items.errorKey);
  }

  /** Resolves to true when the change was saved. */
  async setPublished(published: boolean): Promise<boolean> {
    const business = this.panel.business();
    if (!business || this._busy() || (published && this.missing().length > 0)) return false;
    this._busy.set(true);
    this._errorKey.set(null);
    const result = await this.owned.setPublished(business.id, published);
    this._busy.set(false);
    if (result.errorKey) {
      this._errorKey.set(result.errorKey);
      return false;
    }
    this.panel.patch({ is_active: published });
    return true;
  }
}
