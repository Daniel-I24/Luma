import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CONTACT_EMAIL } from '@core/config/support';
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
  templateUrl: './legal-document.page.html',
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
