import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { APP_VERSION } from '@core/config/app-version';
import { AI_MODE } from '@core/config/build-flags';
import { LumaButton } from '@design-system';
import { PanelQueryLog } from '@shared/business/diagnostics/panel-query-log';
import { DeviceStatus } from '@shared/errors/device-status/device-status';
import { RecentErrors } from '@shared/errors/recent-errors/recent-errors';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { LocationStatus } from '../../components/location-status/location-status';
import { PushServerStatus } from '../../components/push-server-status/push-server-status';

const SHORT_ID = 8;
const VISIBLE_START = 1;

/**
 * AdminTechnicalPage — /admin/technical, only with admin_access 'ok' (adminGuard):
 * the account (masked e-mail, shortened id), how this build runs, the reads of the
 * business panel, the push server, the state of this phone and the recent errors. No personal data;
 * "Copiar" puts the same text on the clipboard.
 */
@Component({
  selector: 'app-admin-technical-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaButton, PushServerStatus, DeviceStatus, LocationStatus, RecentErrors],
  templateUrl: './admin-technical.page.html',
  host: { class: 'block' },
})
export class AdminTechnicalPage {
  private readonly auth = inject(AuthService);
  private readonly navigator = inject(DOCUMENT).defaultView?.navigator;
  protected readonly log = inject(PanelQueryLog);
  private readonly geo = inject(GeolocationService);

  protected readonly copied = signal<'ok' | 'failed' | null>(null);
  protected readonly email = computed(() => AdminTechnicalPage.maskEmail(this.auth.user()?.email ?? ''));
  protected readonly userId = computed(() => `${(this.auth.user()?.id ?? '').slice(0, SHORT_ID)}…`);
  /** How this build runs Luma IA (AI_MODE at build time; docs/ai.md). */
  protected readonly aiMode = inject(AI_MODE);
  /** The plain text "Copiar" puts on the clipboard. */
  protected readonly report = computed(() =>
    [
      `Luma ${APP_VERSION}`,
      `user ${this.userId()} ${this.email()}`,
      `ai mode: ${this.aiMode}`,
      `location: ${this.locationLine()}`,
      ...this.log.entries().map((q) => `${q.at} ${q.table} [${q.filter}] -> ${q.rows ?? 'error'}`),
    ].join('\n'),
  );

  /** The last location attempt, with no position in it. */
  private locationLine(): string {
    const last = this.geo.lastAttempt();
    return last ? `${last.outcome} ${last.source} ${last.access} ${last.accuracyM ?? '-'} m ${last.code ?? ''}`.trim() : 'none';
  }

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
