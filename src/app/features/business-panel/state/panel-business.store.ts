import { Injectable, inject, signal } from '@angular/core';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import type { Business } from '@shared/business/models/business.model';

export type PanelState = 'loading' | 'ready' | 'notFound' | 'error';

/** PanelBusinessStore — the business a panel screen manages (the user's own only). */
@Injectable()
export class PanelBusinessStore {
  private readonly repo = inject(OwnedBusinessRepository);

  private readonly _state = signal<PanelState>('loading');
  private readonly _business = signal<Business | null>(null);
  readonly state = this._state.asReadonly();
  readonly business = this._business.asReadonly();

  async load(id: string): Promise<void> {
    this._state.set('loading');
    const result = await this.repo.getMine(id);
    if (result.errorKey) {
      this._state.set('error');
      return;
    }
    this._business.set(result.data);
    this._state.set(result.data ? 'ready' : 'notFound');
  }

  /** Keeps the local copy in step after a successful save. */
  patch(changes: Partial<Business>): void {
    this._business.update((business) => (business ? { ...business, ...changes } : business));
  }
}
