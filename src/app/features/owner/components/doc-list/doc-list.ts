import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon, LumaIconButton, ToastService } from '@design-system';
import {
  DOC_KINDS,
  DOC_TYPES,
  type DocKind,
  type VerificationDoc,
} from '@shared/business/verification/verification.model';
import { VerificationStore } from '../../state/verification.store';

/** Required for the review (submit_business_for_review). */
const REQUIRED: readonly DocKind[] = ['rut', 'facade'];

/**
 * DocList — verification documents by kind (RUT and facade photo required),
 * uploaded to the private bucket; never shown to customers.
 */
@Component({
  selector: 'app-doc-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIcon, LumaIconButton],
  templateUrl: './doc-list.html',
})
export class DocList {
  protected readonly store = inject(VerificationStore);
  private readonly toast = inject(ToastService);

  protected readonly kinds = DOC_KINDS;
  protected readonly accept = DOC_TYPES.join(',');
  protected readonly byKind = computed(() => {
    const groups: Record<DocKind, VerificationDoc[]> = { rut: [], facade: [], other: [] };
    for (const doc of this.store.docs()) groups[doc.kind].push(doc);
    return groups;
  });

  protected isRequired(kind: DocKind): boolean {
    return REQUIRED.includes(kind);
  }

  protected async upload(kind: DocKind, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (await this.store.uploadDoc(kind, file)) {
      this.toast.show({ messageKey: 'owner.verificationPage.docUploaded', tone: 'success' });
    }
  }

  protected async remove(doc: VerificationDoc): Promise<void> {
    await this.store.deleteDoc(doc);
  }

  /** "abc123.pdf" from the storage path (never the full path). */
  protected fileName(doc: VerificationDoc): string {
    return doc.storage_path.slice(doc.storage_path.lastIndexOf('/') + 1);
  }
}
