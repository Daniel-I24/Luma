import { Injectable, inject, signal } from '@angular/core';
import type { PromotionInput } from '@shared/business/data/business-write.schemas';
import { PromotionWriteRepository } from '@shared/business/data/promotion-write.repository';
import type { Promotion } from '@shared/business/models/business.model';
import { BusinessImageRepository } from '@shared/media/business-image.repository';

/** PromotionsPanelStore — every promotion of the managed business and its edits. */
@Injectable()
export class PromotionsPanelStore {
  private readonly repo = inject(PromotionWriteRepository);
  private readonly images = inject(BusinessImageRepository);

  private readonly _promotions = signal<readonly Promotion[]>([]);
  private readonly _busy = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  readonly promotions = this._promotions.asReadonly();
  readonly busy = this._busy.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();

  async load(businessId: string): Promise<boolean> {
    const result = await this.repo.listForOwner(businessId);
    this._promotions.set(result.data ?? []);
    return !result.errorKey;
  }

  /** Creates (no id) or updates a promotion; a replaced picture is deleted once saved. */
  async save(businessId: string, id: string | null, input: PromotionInput): Promise<boolean> {
    return this.run(async () => {
      const result = id
        ? await this.repo.update(id, input)
        : await this.repo.create(businessId, input);
      const saved = result.data;
      const previous = this._promotions().find((p) => p.id === id)?.image_url;
      if (saved && previous && previous !== saved.image_url) await this.images.remove(previous);
      if (saved) {
        this._promotions.update((list) =>
          list.some((p) => p.id === saved.id)
            ? list.map((p) => (p.id === saved.id ? saved : p))
            : [saved, ...list],
        );
      }
      return result.errorKey;
    });
  }

  async end(promotion: Promotion, now: Date = new Date()): Promise<boolean> {
    return this.run(async () => {
      const result = await this.repo.end(promotion, now);
      if (result.data) {
        const started = Date.parse(promotion.starts_at) < now.getTime();
        const ended = {
          ...promotion,
          is_active: false,
          ends_at: started ? now.toISOString() : promotion.ends_at,
        };
        this._promotions.update((list) => list.map((p) => (p.id === promotion.id ? ended : p)));
      }
      return result.errorKey;
    });
  }

  clearError(): void {
    this._errorKey.set(null);
  }

  private async run(action: () => Promise<string | null>): Promise<boolean> {
    if (this._busy()) return false;
    this._busy.set(true);
    this._errorKey.set(null);
    try {
      const errorKey = await action();
      this._errorKey.set(errorKey);
      return errorKey === null;
    } finally {
      this._busy.set(false);
    }
  }
}
