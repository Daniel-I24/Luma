import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaNotice } from '@design-system';
import type { PendingContactVerification } from '@shared/business/verification/contact-verification';
import {
  type ContactDecision, ContactVerificationRepository,
} from '@shared/business/verification/contact-verification.repository';
import { ContactRequestCard } from './contact-request-card';

/**
 * ContactQueue — the review team's contact verifications, oldest first:
 * each one to check and to verify or reject with a reason (admin with aal2,
 * audited, the owner is notified). Phones and WhatsApp are checked in the
 * support WhatsApp chat itself.
 */
@Component({
  selector: 'app-contact-queue',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaNotice, TranslocoModule, ContactRequestCard],
  template: `
    <section *transloco="let t" class="flex flex-col gap-3" aria-labelledby="contact-queue-title">
      <h2 id="contact-queue-title" class="m-0 text-title text-fg">
        {{ t('admin.contacts.title', { count: items().length }) }}
      </h2>
      @if (errorKey(); as key) {
      <app-luma-notice tone="danger">{{ t(key) }}</app-luma-notice>
      }
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        @for (item of items(); track item.id) {
        <li><app-contact-request-card [item]="item" [busy]="busyId() !== null" (decided)="decide(item, $event)" /></li>
        } @empty {
        <li class="text-body-sm text-fg-muted">{{ t('admin.contacts.empty') }}</li>
        }
      </ul>
    </section>
  `,
})
export class ContactQueue {
  private readonly repo = inject(ContactVerificationRepository);

  protected readonly items = signal<readonly PendingContactVerification[]>([]);
  protected readonly busyId = signal<string | null>(null);
  protected readonly errorKey = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    const result = await this.repo.pending();
    this.errorKey.set(result.errorKey);
    if (result.data) this.items.set(result.data);
  }

  protected async decide(item: PendingContactVerification, decision: ContactDecision): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(item.id);
    const result = await this.repo.decide(item.id, decision);
    this.errorKey.set(result.errorKey);
    await this.load();
    this.busyId.set(null);
  }
}
