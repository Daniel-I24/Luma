import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ExternalUrls } from '@core/config/external-urls';
import { LumaButton, LumaInput } from '@design-system';
import type { PendingContactVerification } from '@shared/business/verification/contact-verification';
import type { ContactDecision } from '@shared/business/verification/contact-verification.repository';
import { ContactVerifiers } from '@shared/business/verification/contact-verifier';

/** The same limits as admin_verify_contact. */
const REASON_MIN = 3;
const REASON_MAX = 300;

/** A link the reviewer opens to check the contact. */
interface CheckLink {
  readonly key: string;
  readonly href: string;
}

/**
 * ContactRequestCard — one request of the queue: business, kind, value and
 * code, links to check it (the Instagram or Facebook profile, the website
 * and its verification file), "Verificar", and "Rechazar" with the reason
 * the owner will read.
 */
@Component({
  selector: 'app-contact-request-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaInput],
  template: `
    <article *transloco="let t" class="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-3">
      <h3 class="m-0 text-body font-medium text-fg">{{ item().business_name }} · {{ t('contactVerification.kind.' + item().kind) }}</h3>
      <p class="m-0 text-body-sm wrap-anywhere text-fg-muted">{{ item().value }}</p>
      <p class="m-0 text-body-sm text-fg">
        {{ t('admin.contacts.code') }} <strong class="font-mono tracking-wider">{{ item().code }}</strong>
      </p>
      @for (link of links(); track link.key) {
      <a class="inline-flex min-h-11 items-center text-body-sm font-semibold text-fg-accent" target="_blank" rel="noopener noreferrer" [href]="link.href">{{ t(link.key) }}</a>
      } @empty {
      <p class="m-0 text-caption text-fg-subtle">{{ t('admin.contacts.checkChat') }}</p>
      }
      @if (rejecting()) {
      <app-luma-input
        [label]="t('admin.contacts.reasonLabel')"
        [placeholder]="t('placeholders.rejectReason')"
        [hint]="t('admin.contacts.reasonHint')"
        [maxLength]="max"
        [counter]="true"
        [errorMessage]="tooShort() ? t('admin.contacts.reasonRequired') : undefined"
        [(value)]="reason"
      />
      <div class="flex flex-wrap gap-2">
        <app-luma-button size="sm" variant="danger" [disabled]="busy()" (clicked)="confirmReject()">{{ t('admin.contacts.confirmReject') }}</app-luma-button>
        <app-luma-button size="sm" variant="ghost" [disabled]="busy()" (clicked)="rejecting.set(false)">{{ t('admin.review.cancel') }}</app-luma-button>
      </div>
      } @else {
      <div class="flex flex-wrap gap-2">
        <app-luma-button size="sm" [disabled]="busy()" (clicked)="decided.emit({ status: 'verified' })">{{ t('admin.contacts.verify') }}</app-luma-button>
        <app-luma-button size="sm" variant="danger" [disabled]="busy()" (clicked)="rejecting.set(true)">{{ t('admin.contacts.reject') }}</app-luma-button>
      </div>
      }
    </article>
  `,
})
export class ContactRequestCard {
  public readonly item = input.required<PendingContactVerification>();
  public readonly busy = input(false);
  public readonly decided = output<ContactDecision>();

  protected readonly max = REASON_MAX;
  protected readonly rejecting = signal(false);
  protected readonly reason = signal('');
  protected readonly tooShort = signal(false);

  protected readonly links = computed<CheckLink[]>(() => {
    const { kind, value } = this.item();
    if (kind === 'instagram') return [{ key: 'admin.contacts.openInstagram', href: ExternalUrls.instagram(value) }];
    if (kind === 'facebook') return [{ key: 'admin.contacts.openFacebook', href: ExternalUrls.facebook(value) }];
    if (kind !== 'website') return [];
    const site = ContactVerifiers.siteUrl(value);
    return site
      ? [{ key: 'admin.contacts.openWebsite', href: site }, { key: 'admin.contacts.openFile', href: ContactVerifiers.fileUrl(value) }]
      : [];
  });

  /** The reason is checked here too, so the reviewer sees why before anything is sent. */
  protected confirmReject(): void {
    const reason = this.reason().trim();
    this.tooShort.set(reason.length < REASON_MIN);
    if (!this.tooShort()) this.decided.emit({ status: 'rejected', reason });
  }
}
