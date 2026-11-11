import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton, LumaNotice, LumaSkeleton, LumaRefreshButton, LumaScreenHeader, LumaIconButton } from '@design-system';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { DateFormat } from '@shared/format/date-format';
import { DeviceTest } from '../../components/device-test/device-test';
import { AdminOperationsStore } from '../../state/admin-operations.store';
import { AuditText } from '../../utils/audit-text';

const CENTS_PER_PESO = 100;
/** Short ids on screen: enough to search them in Wompi or Supabase. */
const SHORT_ID = 8;

/** AdminOperationsPage — /admin/operations: payments, strikes and the audit log. */
@Component({
  selector: 'app-admin-operations-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaRefreshButton, LumaNotice, TranslocoModule, LumaScreenHeader, LumaIconButton, LumaButton, LumaSkeleton, CopCurrencyPipe, DeviceTest],
  providers: [AdminOperationsStore],
  templateUrl: './admin-operations.page.html',
  host: { class: 'block' },
})
export class AdminOperationsPage {
  protected readonly ops = inject(AdminOperationsStore);
  private readonly router = inject(Router);
  /** "Registro reciente" in words: never a raw action or status. */
  protected readonly audit = AuditText;
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  constructor() {
    void this.ops.load();
  }

  protected pesos(cents: number): number {
    return Math.trunc(cents / CENTS_PER_PESO);
  }

  protected short(id: string): string {
    return id.slice(0, SHORT_ID);
  }

  protected openTechnical(): void {
    void this.router.navigate(['/admin', 'technical']);
  }

  protected when(iso: string | null): string {
    return iso ? DateFormat.formatDateTime(iso, this.lang()) : '';
  }
}
