import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ExternalUrls } from '@core/config/external-urls';
import { SUPPORT_WHATSAPP } from '@core/config/support';
import { LumaButton, LumaIcon } from '@design-system';
import type { Business } from '@shared/business/models/business.model';
import {
  CONTACT_KINDS, type ContactKind, type ContactVerification, VerifiedContacts,
} from '@shared/business/verification/contact-verification';
import { ContactVerificationRepository } from '@shared/business/verification/contact-verification.repository';
import { type ContactVerifier, ContactVerifiers, type VerifierStrategy } from '@shared/business/verification/contact-verifier';

/** One contact of the business and where its verification stands. */
interface ContactRow {
  readonly kind: ContactKind;
  readonly value: string;
  readonly verified: boolean;
  /** The pending request for the current value, with its code. */
  readonly pending: ContactVerification | null;
  readonly verifier: ContactVerifier;
  /** A fixed line under the WhatsApp strategy: explained, never a badge. */
  readonly landline: boolean;
}

/** "Verificar con WhatsApp": the state is read every 3 s for 2 minutes at most. */
export const WATCH_EVERY_MS = 3_000;
export const WATCH_FOR_MS = 120_000;

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
  imports: [TranslocoModule, LumaButton, LumaIcon],
  templateUrl: './contact-verification.html',
})
export class ContactVerificationCard {
  private readonly repo = inject(ContactVerificationRepository);
  protected readonly support = inject(SUPPORT_WHATSAPP);

  public readonly business = input.required<Business>();

  private readonly requests = signal<readonly ContactVerification[]>([]);
  private readonly config = signal<Partial<Record<ContactKind, VerifierStrategy>>>({});
  protected readonly busy = signal<ContactKind | null>(null);
  protected readonly watching = signal<ContactKind | null>(null);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly websiteKey = signal<string | null>(null);
  private timer: ReturnType<typeof setInterval> | null = null;

  protected readonly rows = computed<ContactRow[]>(() => {
    const business = this.business();
    return CONTACT_KINDS.flatMap((kind) => {
      const value = VerifiedContacts.value(business, kind);
      if (!value) return [];
      const mine = this.requests().filter((r) => r.kind === kind && r.value === value);
      const verifier = ContactVerifiers.for(kind, this.config());
      return [{
        kind, value, verifier,
        verified: VerifiedContacts.isVerified(business, kind) || mine.some((r) => r.status === 'verified'),
        pending: mine.find((r) => r.status === 'pending') ?? null,
        landline: verifier.strategy === 'whatsapp' && ContactVerifiers.isLandline(value),
      }];
    });
  });

  constructor() {
    effect(() => {
      const id = this.business().id;
      untracked(() => void Promise.all([this.load(id), this.loadConfig()]));
    });
    inject(DestroyRef).onDestroy(() => this.stopWatching());
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
  protected watch(kind: ContactKind): void {
    this.stopWatching();
    this.watching.set(kind);
    const until = Date.now() + WATCH_FOR_MS;
    this.timer = setInterval(() => {
      void this.load(this.business().id).then(() => {
        const row = this.rows().find((r) => r.kind === kind);
        if (row?.verified || Date.now() >= until) this.stopWatching();
      });
    }, WATCH_EVERY_MS);
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

  private stopWatching(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.watching.set(null);
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
