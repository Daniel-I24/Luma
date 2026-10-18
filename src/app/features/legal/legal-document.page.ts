import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { map } from 'rxjs';
import { LumaIconButton } from '@design-system';
import { TERMS_VERSION } from '@shared/legal/legal-version';
import { LEGAL_DOCUMENTS, type LegalDocument, isLegalDocument } from './legal-documents';

/** LegalDocumentPage — /legal/terms and /legal/privacy (drafts pending legal review). */
@Component({
  selector: 'app-legal-document-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIconButton],
  templateUrl: './legal-document.page.html',
  host: { class: 'block min-h-dvh bg-canvas' },
})
export class LegalDocumentPage {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  protected readonly document = toSignal(
    inject(ActivatedRoute).data.pipe(
      map((data): LegalDocument =>
        isLegalDocument(data['document']) ? data['document'] : 'terms',
      ),
    ),
    { initialValue: 'terms' as LegalDocument },
  );
  protected readonly sections = computed(() => LEGAL_DOCUMENTS[this.document()]);
  protected readonly version = TERMS_VERSION;

  /** Back to where the user came from (sign-up or Profile); home when opened directly. */
  protected back(): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) this.location.back();
    else void this.router.navigateByUrl('/');
  }
}
