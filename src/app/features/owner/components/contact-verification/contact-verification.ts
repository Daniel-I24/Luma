import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ExternalUrls } from '@core/config/external-urls';
import { SUPPORT_WHATSAPP } from '@core/config/build-flags';
import { LumaButton, LumaIcon, LumaNotice } from '@design-system';
import type { Business } from '@shared/business/models/business.model';
import { type ContactState, ContactStates } from '@shared/business/verification/contact-state';
import {
  CONTACT_KINDS, type ContactKind, type ContactVerification, VerifiedContacts,
} from '@shared/business/verification/contact-verification';
import { ContactVerificationRepository } from '@shared/business/verification/contact-verification.repository';
import { ContactWatch } from './contact-watch';
import { type ContactVerifier, ContactVerifiers, type VerifierStrategy } from '@shared/business/verification/contact-verifier';

/** One contact of the business and where its verification stands. */
interface ContactRow {
  readonly kind: ContactKind;
  readonly value: string;
  readonly state: ContactState['status'];
  /** The request in review for the current value, with its code. */
  readonly pending: ContactVerification | null;
  /** Why the team rejected it, when it did. */
  readonly reason: string | null;
  readonly verifier: ContactVerifier;
  /** A fixed line under the WhatsApp strategy: explained, never a badge. */
  readonly landline: boolean;
}

export { WATCH_EVERY_MS, WATCH_FOR_MS } from './contact-watch';

/** The badge of each state: neutral, in review, verified, rejected. */
const BADGE: Readonly<Record<ContactState['status'], string>> = {
  unverified: 'bg-surface-selected text-fg-muted',
  review: 'bg-info-bg text-info-fg',
  verified: 'bg-success-bg text-success-fg',
  rejected: 'bg-danger-bg text-danger-fg',
};

/**
 * ContactVerificationCard — every contact with its state and the way it is
 * proved (ContactVerifiers): phone and WhatsApp by a WhatsApp message from
 * that number (automatic), the website by a file Luma checks (automatic),
 * Instagram and Facebook by the team (manual queue). With an automatic
 * strategy off, the contact falls back to the queue.
 */
@Component({
  selector: 'app-contact-verification',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaNotice, TranslocoModule, LumaButton, LumaIcon],
  templateUrl: './contact-verification.html',
})
export class ContactVerificationCard {
  private readonly repo = inject(ContactVerificationRepository);
  protected readonly support = inject(SUPPORT_WHATSAPP);
  protected readonly badge = BADGE;

  public readonly business = input.required<Business>();

  private readonly requests = signal<readonly ContactVerification[]>([]);
  private readonly config = signal<Partial<Record<ContactKind, VerifierStrategy>>>({});
  protected readonly busy = signal<ContactKind | null>(null);
  private readonly watch = new ContactWatch();
  protected readonly watching = this.watch.watching;
  /** Watched for 2 minutes without the message arriving: the request waits for the team. */
  protected readonly timedOut = this.watch.timedOut;
  protected readonly errorKey = signal<string | null>(null);
  protected readonly websiteKey = signal<string | null>(null);

  protected readonly rows = computed<ContactRow[]>(() => {
    const business = this.business();
    return CONTACT_KINDS.flatMap((kind) => {
      const value = VerifiedContacts.value(business, kind);
      if (!value) return [];
      const verifier = ContactVerifiers.for(kind, this.config());
      const mine = this.requests().filter((r) => r.kind === kind);
      const state = ContactStates.of(mine, value, VerifiedContacts.isVerified(business, kind));
      return [{
        kind, value, verifier,
        state: state.status,
        pending: state.status === 'review' ? state.request : null,
        reason: state.status === 'rejected' ? state.reason : null,
        landline: verifier.strategy === 'whatsapp' && ContactVerifiers.isLandline(value),
      }];
    });
  });

  constructor() {
    effect(() => {
      const id = this.business().id;
      untracked(() => void Promise.all([this.load(id), this.loadConfig()]));
    });
    inject(DestroyRef).onDestroy(() => this.watch.stop());
  }

  /** Asks for a code; the steps appear with it. */
  protected async request(kind: ContactKind): Promise<void> {
    if (this.busy()) return;
    this.busy.set(kind);
    this.errorKey.set(null);
    const result = await this.repo.request(this.business().id, kind);
    if (result.errorKey) this.errorKey.set(result.errorKey);
    await this.load(this.business().id);
    this.busy.set(null);
  }

  /** wa.me link to Luma support with the code already typed. */
  protected supportLink(code: string): string {
    return ExternalUrls.whatsappMessage(this.support, code);
  }

  /** Opened WhatsApp: watch until verified or 2 minutes pass. */
  protected watchFor(kind: ContactKind): void {
    this.watch.start(kind, async () => {
      await this.load(this.business().id);
      return this.rows().find((r) => r.kind === kind)?.state === 'verified';
    });
  }

  /** "Comprobar ahora": verify-website looks for the file. */
  protected async checkWebsite(): Promise<void> {
    if (this.busy()) return;
    this.busy.set('website');
    this.websiteKey.set(null);
    const result = await this.repo.checkWebsite(this.business().id);
    this.websiteKey.set(result.verified ? 'contactVerification.website.verified' : result.reasonKey);
    await this.load(this.business().id);
    this.busy.set(null);
  }

  /** Where the website must publish the code. */
  protected fileUrl(website: string): string {
    return ContactVerifiers.fileUrl(website);
  }

  private async loadConfig(): Promise<void> {
    this.config.set(await this.repo.config());
  }

  private async load(businessId: string): Promise<void> {
    const result = await this.repo.listMine(businessId);
    if (result.data) this.requests.set(result.data);
    else this.errorKey.set(result.errorKey);
  }
}
