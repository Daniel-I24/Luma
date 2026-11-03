import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, ToastService } from '@design-system';
import { PromotionWriteRepository } from '@shared/business/data/promotion-write.repository';
import type { Promotion } from '@shared/business/models/business.model';

/**
 * NotifyFollowers — "Avisar a mis seguidores" on a running promotion: a
 * notice to the customers who saved the business and accepted promotions.
 * Once per promotion (the database enforces it and the daily limit).
 */
@Component({
  selector: 'app-notify-followers',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton],
  template: `
    <ng-container *transloco="let t">
      @if (done()) {
        <span class="text-caption text-fg-muted">{{ t('businessPanel.notify.sent') }}</span>
      } @else {
        <app-luma-button variant="secondary" size="sm" [disabled]="busy()" (clicked)="notify()">{{
          t(busy() ? 'businessPanel.notify.sending' : 'businessPanel.notify.action')
        }}</app-luma-button>
      }
    </ng-container>
  `,
})
export class NotifyFollowers {
  private readonly repo = inject(PromotionWriteRepository);
  private readonly toast = inject(ToastService);

  public readonly promotion = input.required<Promotion>();

  protected readonly busy = signal(false);
  private readonly sentNow = signal(false);
  protected readonly done = computed(() => this.sentNow() || !!this.promotion().notified_at);

  protected async notify(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    const result = await this.repo.notifyFollowers(this.promotion().id);
    this.busy.set(false);
    if (result.data === null) {
      this.toast.show({ messageKey: result.errorKey ?? 'businessPanel.notify.failed', tone: 'error' });
      return;
    }
    this.sentNow.set(true);
    this.toast.show({
      messageKey: result.data > 0 ? 'businessPanel.notify.done' : 'businessPanel.notify.nobody',
      params: { count: result.data },
      tone: 'success',
    });
  }
}
