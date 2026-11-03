import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { RouteBusinessId } from '../../utils/route-business-id';

/** SetupReturn — "Volver al asistente" on a step screen opened from the business wizard (?setup=1). */
@Component({
  selector: 'app-setup-return',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink],
  template: `
    @if (fromWizard) {
      <a
        *transloco="let t"
        class="pressable flex min-h-11 items-center justify-center rounded-xl border border-border-focus bg-surface px-4 text-body font-medium text-fg-brand no-underline"
        [routerLink]="link()"
        >{{ t('owner.wizard.back') }}</a
      >
    }
  `,
})
export class SetupReturn {
  private readonly router = inject(Router);
  private readonly id = RouteBusinessId.routeBusinessId();
  /** Read once: the URL this screen was opened with (during or after the navigation). */
  protected readonly fromWizard =
    (this.router.getCurrentNavigation()?.finalUrl ?? this.router.parseUrl(this.router.url)).queryParamMap.get('setup') === '1';
  protected readonly link = computed(() => ['/owner', this.id(), 'setup']);
}
