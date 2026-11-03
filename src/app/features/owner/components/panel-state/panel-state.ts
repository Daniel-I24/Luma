import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState, LumaSkeleton } from '@design-system';
import type { PanelState } from '../../state/panel-business.store';

/** PanelStateView — loading skeleton, not found and error states; content when ready. */
@Component({
  selector: 'app-panel-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaEmptyState, LumaSkeleton],
  template: `
    <ng-container *transloco="let t">
      @switch (state()) { @case ('loading') {
      <div class="flex flex-col gap-3" aria-busy="true">
        <app-luma-skeleton class="h-24 w-full" shape="rect" />
        <app-luma-skeleton class="h-16 w-full" shape="rect" />
        <app-luma-skeleton class="h-16 w-full" shape="rect" />
        <span class="sr-only">{{ t('businessPanel.loading') }}</span>
      </div>
      } @case ('notFound') {
      <app-luma-empty-state
        icon="store"
        [heading]="t('businessPanel.notFound.title')"
        [description]="t('businessPanel.notFound.description')"
      />
      } @case ('error') {
      <div role="alert">
        <app-luma-empty-state
          icon="alert"
          tone="error"
          [heading]="t('businessPanel.errors.loadFailed')"
        >
          <app-luma-button (clicked)="retry.emit()">{{ t('common.retry') }}</app-luma-button>
        </app-luma-empty-state>
      </div>
      } @default {
      <ng-content />
      } }
    </ng-container>
  `,
})
export class PanelStateView {
  public readonly state = input.required<PanelState>();
  public readonly retry = output<void>();
}
