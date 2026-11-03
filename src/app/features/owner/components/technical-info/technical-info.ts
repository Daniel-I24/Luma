import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AI_MODE } from '@core/config/ai-mode';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { APP_VERSION } from '@core/config/app-version';
import { LumaButton, LumaDisclosure } from '@design-system';
import { PanelQueryLog } from '@shared/business/diagnostics/panel-query-log';
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
  imports: [TranslocoModule, LumaButton, LumaDisclosure],
  templateUrl: './technical-info.html',
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
