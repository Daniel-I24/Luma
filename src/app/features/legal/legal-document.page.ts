import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CONTACT_EMAIL } from '@core/config/build-flags';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { map } from 'rxjs';
import { LumaIconButton, LumaTabs, type TabItem } from '@design-system';
import { TranslocoService } from '@jsverse/transloco';
import { LEGAL_VERSIONS } from '@shared/legal/legal-version';
import { LEGAL_DOCUMENTS, type LegalDocument, LegalDocuments } from './legal-documents';

const TABS: readonly LegalDocument[] = ['terms', 'privacy', 'refunds'];

/**
 * LegalDocumentPage — "Legal": one screen with tabs (Términos, Privacidad,
 * Reembolsos), each tab its own address (/legal/terms, /legal/privacy,
 * /legal/refunds), so deep links keep working; /legal/deletion has no tab.
 */
@Component({
  selector: 'app-legal-document-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIconButton, LumaTabs],
  template: `
    <article
      *transloco="let t"
      class="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-[calc(env(safe-area-inset-top)+var(--spacing-4))] pb-[calc(env(safe-area-inset-bottom)+var(--spacing-8))]"
    >
      <header class="flex items-center gap-2">
        <app-luma-icon-button
          icon="arrow-left"
          variant="ghost"
          [label]="t('common.back')"
          (clicked)="back()"
        />
        <h1 class="m-0 text-title text-fg">{{ t(tabbed() ? 'profile.help.legal' : 'legal.' + document() + '.title') }}</h1>
      </header>
      @if (tabbed()) {
      <app-luma-tabs idPrefix="legal" [label]="t('profile.help.legal')" [tabs]="tabs()" [selected]="document()" (selectedChange)="selectTab($event)" />
      }

      <p
        class="m-0 rounded-md bg-warning-bg p-3 text-body-sm font-semibold text-warning-fg"
        role="note"
      >
        {{ t('legal.draftNotice') }}
      </p>
      <p class="m-0 text-body-sm text-fg-muted">{{ t('legal.version', { version: version() }) }}</p>

      <div class="flex flex-col gap-5" [id]="'legal-panel-' + document()" [attr.role]="tabbed() ? 'tabpanel' : null" [attr.aria-labelledby]="tabbed() ? 'legal-tab-' + document() : null">
      @for (section of sections(); track section) {
      <section class="flex flex-col gap-2" [attr.aria-labelledby]="'legal-' + section">
        <h2 [id]="'legal-' + section" class="m-0 text-label-lg text-fg">
          {{ t('legal.' + document() + '.sections.' + section + '.title') }}
        </h2>
        <p class="m-0 text-body text-fg-muted">
          {{ t('legal.' + document() + '.sections.' + section + '.body', { email: email || t('legal.contactPending') }) }}
        </p>
      </section>
      }
      </div>
    </article>
  `,
  host: { class: 'block min-h-dvh bg-canvas' },
})
export class LegalDocumentPage {
  private readonly location = inject(Location);
  /** The contact e-mail the texts mention (LEGAL_CONTACT_EMAIL at build time). */
  protected readonly email = inject(CONTACT_EMAIL);
  private readonly router = inject(Router);

  protected readonly document = toSignal(
    inject(ActivatedRoute).data.pipe(
      map((data): LegalDocument =>
        LegalDocuments.isLegalDocument(data['document']) ? data['document'] : 'terms',
      ),
    ),
    { initialValue: 'terms' as LegalDocument },
  );
  protected readonly sections = computed(() => LEGAL_DOCUMENTS[this.document()]);
  private readonly transloco = inject(TranslocoService);
  protected readonly tabs = computed<readonly TabItem[]>(() =>
    TABS.map((id) => ({ id, label: this.transloco.translate(`legal.${id}.title`) })),
  );
  protected readonly tabbed = computed(() => (TABS as readonly string[]).includes(this.document()));

  /** Each tab is its own address (replaced, so "back" leaves the legal screen). */
  protected selectTab(id: string): void {
    if (LegalDocuments.isLegalDocument(id)) void this.router.navigate(['/legal', id], { replaceUrl: true });
  }
  protected readonly version = computed(() => LEGAL_VERSIONS[this.document()]);

  /** Back to where the user came from (sign-up or Profile); home when opened directly. */
  protected back(): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) this.location.back();
    else void this.router.navigateByUrl('/');
  }
}
