import { Injectable, inject, signal } from '@angular/core';
import type { Business } from '@shared/business/models/business.model';
import { AdminRepository } from '@shared/business/verification/admin.repository';
import type { OpenReport } from '@shared/business/verification/verification.model';

export type QueueState = 'loading' | 'ready' | 'error';

/** AdminQueueStore — businesses waiting for review and open reports. */
@Injectable()
export class AdminQueueStore {
  private readonly repo = inject(AdminRepository);

  private readonly _state = signal<QueueState>('loading');
  private readonly _pending = signal<readonly Business[]>([]);
  private readonly _reports = signal<readonly OpenReport[]>([]);
  private readonly _errorKey = signal<string | null>(null);
  readonly state = this._state.asReadonly();
  readonly pending = this._pending.asReadonly();
  readonly reports = this._reports.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();

  async load(): Promise<void> {
    this._state.set('loading');
    const [pending, reports] = await Promise.all([this.repo.pendingBusinesses(), this.repo.openReports()]);
    if (!pending.data || !reports.data) {
      this._state.set('error');
      return;
    }
    this._pending.set(pending.data);
    this._reports.set(reports.data);
    this._state.set('ready');
  }

  async resolve(report: OpenReport, status: 'reviewed' | 'dismissed'): Promise<void> {
    this._errorKey.set(null);
    const result = await this.repo.resolveReport(report.id, status);
    if (result.errorKey) {
      this._errorKey.set(result.errorKey);
      return;
    }
    this._reports.update((list) => list.filter((r) => r.id !== report.id));
  }
}
