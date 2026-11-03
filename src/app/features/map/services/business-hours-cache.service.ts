import { Injectable, inject } from '@angular/core';
import { BusinessRepository } from '@shared/business/data/business.repository';
import type { BusinessHours } from '@shared/business/models/business.model';

/**
 * Caches weekly hours per business so map markers and the sheet
 * share one fetch — pan/zoom and taps do not repeat network calls.
 */
@Injectable({ providedIn: 'root' })
export class BusinessHoursCacheService {
  private readonly repo = inject(BusinessRepository);
  private readonly cache = new Map<string, BusinessHours[]>();

  /** True when the hours of the business are cached. */
  public has(businessId: string): boolean {
    return this.cache.has(businessId);
  }

  /** Cached hours of a business (empty when unknown). */
  public get(businessId: string): BusinessHours[] {
    return this.cache.get(businessId) ?? [];
  }

  /** A copy of the whole cache. */
  public snapshot(): Map<string, BusinessHours[]> {
    return this.cache;
  }

  /** Drops the hours of these businesses (they changed): the next prefetch reads them. */
  public forget(businessIds: readonly string[]): void {
    for (const id of businessIds) this.cache.delete(id);
  }

  /**
   * Loads hours for ids not yet cached, in parallel.
   * Failed fetches are stored as [] so the same id is not retried forever.
   */
  public async prefetch(businessIds: string[]): Promise<void> {
    const missing = businessIds.filter((id) => !this.cache.has(id));
    if (missing.length === 0) return;

    const results = await Promise.all(missing.map((id) => this.repo.getHours(id)));
    missing.forEach((id, i) => this.cache.set(id, results[i].data ?? []));
  }
}
