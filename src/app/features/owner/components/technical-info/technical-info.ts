import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AI_MODE } from '@core/config/build-flags';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { APP_VERSION } from '@core/config/app-version';
import { LumaButton, LumaDisclosure } from '@design-system';
import { PanelQueryLog } from '@shared/business/diagnostics/panel-query-log';
import { DeviceStatus } from '@shared/errors/device-status/device-status';
import { RecentErrors } from '@shared/errors/recent-errors/recent-errors';
import { OwnerContextStore } from '../../state/owner-context.store';

const SHORT_ID = 8;
const VISIBLE_START = 1;

/**
 * TechnicalInfo — Mi negocio → Ayuda → "Información técnica": the account
 * (masked e-mail, shortened user id), how many businesses the panel holds and
 * every read of the panel with its table, filter and rows received. No
 * personal data; "Copiar" puts the same text on the clipboard for support.
 */
@Component({
  selector: 'app-technical-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaDisclosure, DeviceStatus, RecentErrors],
  template: `
    <ng-container *transloco="let t">
      <app-luma-disclosure panelId="technical-info" icon="info" [heading]="t('owner.technical.title')" [description]="t('owner.technical.hint')">
        <div class="flex flex-col gap-3 px-4 pb-4">
          <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body-sm">
            <dt class="text-fg-muted">{{ t('owner.technical.email') }}</dt>
            <dd class="m-0 font-mono text-fg">{{ email() }}</dd>
            <dt class="text-fg-muted">{{ t('owner.technical.user') }}</dt>
            <dd class="m-0 font-mono text-fg">{{ userId() }}</dd>
            <dt class="text-fg-muted">{{ t('owner.technical.businesses') }}</dt>
            <dd class="m-0 font-mono text-fg">{{ businesses() }}</dd>
            <dt class="text-fg-muted">{{ t('owner.technical.aiMode') }}</dt>
            <dd class="m-0 font-mono text-fg">{{ aiMode }}</dd>
          </dl>
          <table class="w-full border-collapse text-caption">
            <caption class="pb-1 text-left text-caption text-fg-muted">{{ t('owner.technical.queries') }}</caption>
            <thead>
              <tr class="text-left text-fg-muted">
                <th scope="col" class="py-1 pe-2 font-semibold">{{ t('owner.technical.table') }}</th>
                <th scope="col" class="py-1 pe-2 font-semibold">{{ t('owner.technical.filter') }}</th>
                <th scope="col" class="py-1 font-semibold">{{ t('owner.technical.rows') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (query of log.entries(); track $index) {
              <tr class="border-t border-border-subtle font-mono text-fg">
                <td class="py-1 pe-2">{{ query.table }}</td>
                <td class="py-1 pe-2 break-all">{{ query.filter }}</td>
                <td class="py-1">{{ query.rows ?? t('owner.technical.failed') }}</td>
              </tr>
              } @empty {
              <tr>
                <td colspan="3" class="py-1 text-fg-muted">{{ t('owner.technical.empty') }}</td>
              </tr>
              }
            </tbody>
          </table>
          <app-luma-button variant="secondary" size="sm" (clicked)="copy()">{{ t('owner.technical.copy') }}</app-luma-button>
          @if (copied(); as result) {
          <p class="m-0 text-caption text-fg-muted" role="status">{{ t('owner.technical.copied.' + result) }}</p>
          }
          <app-device-status />
          <app-recent-errors />
        </div>
      </app-luma-disclosure>
    </ng-container>
  `,
})
export class TechnicalInfo {
  private readonly auth = inject(AuthService);
  private readonly context = inject(OwnerContextStore);
  private readonly navigator = inject(DOCUMENT).defaultView?.navigator;
  protected readonly log = inject(PanelQueryLog);

  protected readonly copied = signal<'ok' | 'failed' | null>(null);
  protected readonly email = computed(() => TechnicalInfo.maskEmail(this.auth.user()?.email ?? ''));
  protected readonly userId = computed(() => `${(this.auth.user()?.id ?? '').slice(0, SHORT_ID)}…`);
  protected readonly businesses = computed(() => this.context.count());
  /** How this build runs Luma IA (AI_MODE at build time; docs/ai.md). */
  protected readonly aiMode = inject(AI_MODE);
  /** The plain text "Copiar" puts on the clipboard. */
  protected readonly report = computed(() =>
    [
      `Luma ${APP_VERSION}`,
      `user ${this.userId()} ${this.email()}`,
      `businesses in panel: ${this.businesses()}`,
      `ai mode: ${this.aiMode}`,
      ...this.log.entries().map((q) => `${q.at} ${q.table} [${q.filter}] -> ${q.rows ?? 'error'}`),
    ].join('\n'),
  );

  /** An e-mail with only the first letters visible: a…@c….com. */
  public static maskEmail(email: string): string {
    const [user, domain] = email.split('@');
    if (!user || !domain) return '';
    const dot = domain.lastIndexOf('.');
    const host = dot > 0 ? domain.slice(0, dot) : domain;
    const tld = dot > 0 ? domain.slice(dot) : '';
    const mask = (part: string): string => part.slice(0, VISIBLE_START) + '*'.repeat(Math.max(part.length - VISIBLE_START, 1));
    return `${mask(user)}@${mask(host)}${tld}`;
  }

  protected async copy(): Promise<void> {
    try {
      await this.navigator?.clipboard?.writeText(this.report());
      this.copied.set(this.navigator?.clipboard ? 'ok' : 'failed');
    } catch {
      this.copied.set('failed');
    }
  }
}
