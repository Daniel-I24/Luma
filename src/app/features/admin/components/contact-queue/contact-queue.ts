import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ExternalUrls } from '@core/config/external-urls';
import { LumaButton } from '@design-system';
import type { PendingContactVerification } from '@shared/business/verification/contact-verification';
import { ContactVerifiers } from '@shared/business/verification/contact-verifier';
import { ContactVerificationRepository } from '@shared/business/verification/contact-verification.repository';

/**
 * ContactQueue — the review team's contact verifications: business, kind,
 * value, a link to where the code must appear and the code; "Verificar" or
 * "Rechazar" (admin with aal2, audited, the owner is notified). Phones and
 * WhatsApp are checked in the support WhatsApp chat itself.
 */
@Component({
  selector: 'app-contact-queue',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton],
  template: `
    <section *transloco="let t" class="flex flex-col gap-3" aria-labelledby="contact-queue-title">
      <h2 id="contact-queue-title" class="m-0 text-title text-fg">
        {{ t('admin.contacts.title', { count: items().length }) }}
      </h2>
      @if (errorKey(); as key) {
      <p class="m-0 rounded-md bg-danger-bg p-3 text-body-sm text-danger-fg" role="alert">{{ t(key) }}</p>
      }
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        @for (item of items(); track item.id) {
        <li class="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-3">
          <p class="m-0 text-body font-medium text-fg">{{ item.business_name }} · {{ t('contactVerification.kind.' + item.kind) }}</p>
          <p class="m-0 text-body-sm text-fg-muted">{{ item.value }}</p>
          <p class="m-0 text-body-sm text-fg">
            {{ t('admin.contacts.code') }} <strong class="font-mono tracking-wider">{{ item.code }}</strong>
          </p>
          @if (linkOf(item); as link) {
          <a class="text-body-sm text-fg-accent" target="_blank" rel="noopener noreferrer" [href]="link">{{ t('admin.contacts.open') }}</a>
          } @else {
          <p class="m-0 text-caption text-fg-subtle">{{ t('admin.contacts.checkChat') }}</p>
          }
          <div class="flex gap-2">
            <app-luma-button size="sm" [disabled]="busyId() !== null" (clicked)="decide(item, 'verified')">{{ t('admin.contacts.verify') }}</app-luma-button>
            <app-luma-button size="sm" variant="danger" [disabled]="busyId() !== null" (clicked)="decide(item, 'rejected')">{{ t('admin.contacts.reject') }}</app-luma-button>
          </div>
        </li>
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

  protected async decide(item: PendingContactVerification, decision: 'verified' | 'rejected'): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(item.id);
    const result = await this.repo.decide(item.id, decision);
    this.errorKey.set(result.errorKey);
    await this.load();
    this.busyId.set(null);
  }

  /** Where the code must be published, or null for phone and WhatsApp. */
  protected linkOf(item: PendingContactVerification): string | null {
    switch (item.kind) {
      case 'instagram':
        return ExternalUrls.instagram(item.value);
      case 'facebook':
        return ExternalUrls.facebook(item.value);
      case 'website':
        return ContactVerifiers.fileUrl(item.value);
      default:
        return null;
    }
  }
}
