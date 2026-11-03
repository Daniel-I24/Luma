import { Injectable, computed, inject, signal } from '@angular/core';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import type { BusinessHours } from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';
import { PublishRequirements } from '../utils/publish-requirements';
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

  private readonly _hours = signal<readonly BusinessHours[]>([]);
  private readonly _items = signal<readonly MenuItem[]>([]);
  public readonly hours = this._hours.asReadonly();
  public readonly items = this._items.asReadonly();
  private readonly _busy = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  public readonly busy = this._busy.asReadonly();
  public readonly errorKey = this._errorKey.asReadonly();

  public readonly missing = computed(() => {
    const business = this.panel.business();
    return business ? PublishRequirements.missingRequirements(business, this.hours(), this.items()) : [];
  });

  /** Loads what a business still needs before publishing. */
  public async load(id: string): Promise<void> {
    const [hours, items] = await Promise.all([
      this.businesses.getHours(id),
      this.menus.getMenu(id),
    ]);
    this._hours.set(hours.data ?? []);
    this._items.set(items.data ?? []);
    this._errorKey.set(hours.errorKey ?? items.errorKey);
  }

  /** Resolves to true when the change was saved. */
  public async setPublished(published: boolean): Promise<boolean> {
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
