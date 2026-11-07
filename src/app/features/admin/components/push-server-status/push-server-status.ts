import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DateFormat } from '@shared/format/date-format';
import { type PushHealth, PushHealthRepository } from '../../services/push-health.repository';

/**
 * PushServerStatus — the last answer of push-dispatch: HTTP code and Colombian time,
 * with its counts and FCM reasons. Admins only: it lives in /admin/technical.
 */
@Component({
  selector: 'app-push-server-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  template: `
    <section *transloco="let t" class="flex flex-col gap-1" aria-labelledby="tech-push">
      <h2 id="tech-push" class="m-0 text-title text-fg">{{ t('admin.technical.push.title') }}</h2>
      @if (health(); as state) {
        <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body-sm">
          <dt class="text-fg-muted">{{ t('admin.technical.push.code') }}</dt>
          <dd class="m-0 font-mono text-fg">{{ state.status ?? t('admin.technical.push.none') }}</dd>
          <dt class="text-fg-muted">{{ t('admin.technical.push.time') }}</dt>
          <dd class="m-0 text-fg">{{ when() ?? t('admin.technical.push.none') }}</dd>
          <dt class="text-fg-muted">{{ t('admin.technical.push.phones') }}</dt>
          <dd class="m-0 text-fg">{{ state.tokens }}</dd>
          <dt class="text-fg-muted">{{ t('admin.technical.push.unsent') }}</dt>
          <dd class="m-0 text-fg">{{ state.unsent }}</dd>
          <dt class="text-fg-muted">{{ t('admin.technical.push.retrying') }}</dt>
          <dd class="m-0 text-fg">{{ state.retrying }}</dd>
        </dl>
        @if (state.body || state.error) {
          <p class="m-0 break-all font-mono text-caption text-fg-subtle">{{ state.error ?? state.body }}</p>
        }
      } @else if (loaded()) {
        <p class="m-0 text-body-sm text-fg-muted" role="status">{{ t('admin.technical.push.unknown') }}</p>
      }
    </section>
  `,
})
export class PushServerStatus implements OnInit {
  private readonly repo = inject(PushHealthRepository);
  private readonly transloco = inject(TranslocoService);
  protected readonly health = signal<PushHealth | null>(null);
  protected readonly loaded = signal(false);
  protected readonly when = computed(() => {
    const at = this.health()?.at;
    return at ? DateFormat.formatColombia(at, this.transloco.getActiveLang()) : null;
  });

  /** Reads the answer once; "unknown" when it cannot be read (no aal2, no migration). */
  public async ngOnInit(): Promise<void> {
    this.health.set(await this.repo.read());
    this.loaded.set(true);
  }
}
