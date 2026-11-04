import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ErrorLog } from '@core/errors/error-log';
import { LumaButton } from '@design-system';

/**
 * RecentErrors — the last 20 errors of the session (ErrorLog: name, masked
 * message, screen and time) with "Copiar errores" for support. Shown in
 * "Información técnica" of the Profile and of Mi negocio.
 */
@Component({
  selector: 'app-recent-errors',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton],
  template: `
    <section *transloco="let t" class="flex flex-col gap-2" aria-labelledby="recent-errors-title">
      <h3 id="recent-errors-title" class="m-0 text-label text-fg">{{ t('technicalErrors.title') }}</h3>
      <p class="m-0 text-caption text-fg-muted">{{ t('technicalErrors.hint') }}</p>
      <ol class="m-0 flex list-none flex-col gap-1 p-0 font-mono text-caption text-fg">
        @for (entry of log.entries(); track $index) {
          <li class="break-all border-t border-border-subtle pt-1">
            {{ entry.at }} · {{ entry.source }} · {{ entry.route }}<br />{{ entry.name }}: {{ entry.message }}
          </li>
        } @empty {
          <li class="text-fg-muted">{{ t('technicalErrors.empty') }}</li>
        }
      </ol>
      @if (log.entries().length) {
        <app-luma-button variant="secondary" size="sm" (clicked)="copy()">{{ t('technicalErrors.copy') }}</app-luma-button>
      }
      @if (copied(); as result) {
        <p class="m-0 text-caption text-fg-muted" role="status">{{ t('technicalErrors.copied.' + result) }}</p>
      }
    </section>
  `,
})
export class RecentErrors {
  private readonly clipboard = inject(DOCUMENT).defaultView?.navigator?.clipboard;
  protected readonly log = inject(ErrorLog);
  protected readonly copied = signal<'ok' | 'failed' | null>(null);

  protected async copy(): Promise<void> {
    if (!this.clipboard) return this.copied.set('failed');
    try {
      await this.clipboard.writeText(this.log.report());
      this.copied.set('ok');
    } catch {
      this.copied.set('failed');
    }
  }
}
