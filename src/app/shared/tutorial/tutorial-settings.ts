import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon } from '@design-system/icon/luma-icon';
import { ToastService } from '@design-system/toast/toast.service';
import { GuidedTour } from './guided-tour.service';

/**
 * TutorialSettings — "Ver tutorial" (the welcome screens over this screen)
 * and "Ver todos los tutoriales" (every section guide shows again). Shared
 * by the Profile and "Mi negocio".
 */
@Component({
  selector: 'app-tutorial-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIcon],
  template: `
    <ng-container *transloco="let t">
      <button type="button" [class]="rowClass" (click)="tour.openWelcome()">
        <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-selected text-fg-brand">
          <app-luma-icon name="compass" />
        </span>
        <span class="flex-1 text-left text-body font-medium">{{ t('profile.help.tutorial') }}</span>
      </button>
      <button type="button" [class]="rowClass" (click)="resetAll()">
        <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-selected text-fg-brand">
          <app-luma-icon name="help" />
        </span>
        <span class="flex-1 text-left text-body font-medium">{{ t('profile.help.allTutorials') }}</span>
      </button>
    </ng-container>
  `,
  host: { class: 'flex flex-col gap-2', 'data-tour': 'profile-help' },
})
export class TutorialSettings {
  protected readonly tour = inject(GuidedTour);
  private readonly toast = inject(ToastService);
  protected readonly rowClass =
    'pressable flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus';

  protected resetAll(): void {
    this.tour.resetAll();
    this.toast.show({ messageKey: 'profile.help.allTutorialsReset', tone: 'success' });
  }
}
