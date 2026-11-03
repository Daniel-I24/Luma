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
  templateUrl: './contact-queue.html',
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
