import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { PUSH_STEPS, PushDiagnostics } from '@core/push/push-diagnostics';
import { LumaButton } from '@design-system';
import { AdminRepository } from '@shared/business/verification/admin.repository';

/**
 * DeviceStatus — "Información técnica": the last answer of admin_access and the
 * last result of each push step on this phone. Only codes, times and a masked
 * token, so the text can be sent to support as it is.
 */
@Component({
  selector: 'app-device-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton],
  template: `
    <section *transloco="let t" class="flex flex-col gap-2" aria-labelledby="device-status-title">
      <h3 id="device-status-title" class="m-0 text-label text-fg">{{ t('technicalStatus.title') }}</h3>
      <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-caption">
        <dt class="text-fg-muted">{{ t('technicalStatus.admin') }}</dt>
        <dd class="m-0 font-mono break-all text-fg">{{ adminLine() ?? t('technicalStatus.notYet') }}</dd>
        @for (row of pushRows(); track row.step) {
          <dt class="text-fg-muted">{{ t('technicalStatus.steps.' + row.step) }}</dt>
          <dd class="m-0 font-mono break-all text-fg">{{ row.line ?? t('technicalStatus.notYet') }}</dd>
        }
      </dl>
      <app-luma-button variant="secondary" size="sm" (clicked)="copy()">{{ t('technicalStatus.copy') }}</app-luma-button>
      @if (copied(); as result) {
        <p class="m-0 text-caption text-fg-muted" role="status">{{ t('technicalErrors.copied.' + result) }}</p>
      }
    </section>
  `,
})
export class DeviceStatus {
  private readonly clipboard = inject(DOCUMENT).defaultView?.navigator?.clipboard;
  private readonly admin = inject(AdminRepository);
  private readonly diagnostics = inject(PushDiagnostics);
  protected readonly copied = signal<'ok' | 'failed' | null>(null);

  /** admin_access: "ok", "needs_mfa", "none" or "error <code>", with its time. */
  protected readonly adminLine = computed(() => {
    const last = this.admin.lastAccess();
    return last ? [last.access, last.code, last.at].filter(Boolean).join(' · ') : null;
  });

  protected readonly pushRows = computed(() => {
    const steps = this.diagnostics.steps();
    return PUSH_STEPS.map((step) => {
      const result = steps[step];
      return { step, line: result ? `${result.ok ? 'ok' : 'failed'} · ${result.detail} · ${result.at}` : null };
    });
  });

  protected async copy(): Promise<void> {
    const lines = [`admin: ${this.adminLine() ?? '-'}`, ...this.pushRows().map((r) => `${r.step}: ${r.line ?? '-'}`)];
    try {
      await this.clipboard?.writeText(lines.join('\n'));
      this.copied.set(this.clipboard ? 'ok' : 'failed');
    } catch {
      this.copied.set('failed');
    }
  }
}
