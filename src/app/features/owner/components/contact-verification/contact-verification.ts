import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ExternalUrls } from '@core/config/external-urls';
import { SUPPORT_WHATSAPP } from '@core/config/support';
import { LumaButton, LumaIcon } from '@design-system';
import type { Business } from '@shared/business/models/business.model';
import {
  CONTACT_KINDS, type ContactKind, type ContactVerification, VerifiedContacts,
} from '@shared/business/verification/contact-verification';
import { ContactVerificationRepository } from '@shared/business/verification/contact-verification.repository';

/** One contact of the business and where its verification stands. */
interface ContactRow {
  readonly kind: ContactKind;
  readonly value: string;
  readonly verifiedAt: string | null;
  /** The pending request for the current value, with its code. */
  readonly pending: ContactVerification | null;
}

/** How each contact proves it is the business's: the step under tours of contactVerification.steps. */
const STEP: Readonly<Record<ContactKind, 'message' | 'social' | 'website'>> = {
  phone: 'message', whatsapp: 'message', instagram: 'social', facebook: 'social', website: 'website',
};

/**
 * ContactVerificationCard — every contact of the business with its state:
 * "Verificado" (customers see it, with a badge) or "Pendiente de
 * verificación" with the steps and the LUMA-XXXXXX code: send it from that
 * number to Luma's support WhatsApp, publish it in the bio or a public post,
 * or at <website>/luma-verificacion.txt. A person of the team checks it.
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
  protected readonly busy = signal<ContactKind | null>(null);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly step = STEP;

  protected readonly rows = computed<ContactRow[]>(() => {
    const business = this.business();
    return CONTACT_KINDS.flatMap((kind) => {
      const value = VerifiedContacts.value(business, kind);
      if (!value) return [];
      const pending = this.requests().find((r) => r.kind === kind && r.status === 'pending' && r.value === value) ?? null;
      return [{ kind, value, verifiedAt: VerifiedContacts.verifiedAt(business, kind), pending }];
    });
  });

  constructor() {
    effect(() => {
      const id = this.business().id;
      untracked(() => void this.load(id));
    });
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

  /** Where the website must publish the code. */
  protected fileUrl(website: string): string {
    return `${website.replace(/\/+$/, '')}/luma-verificacion.txt`;
  }

  private async load(businessId: string): Promise<void> {
    const result = await this.repo.listMine(businessId);
    if (result.data) this.requests.set(result.data);
    else this.errorKey.set(result.errorKey);
  }
}
