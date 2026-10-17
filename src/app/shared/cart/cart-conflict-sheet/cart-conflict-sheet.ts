import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaBottomSheet, LumaButton } from '@design-system';
import { CartActions } from '../cart-actions.service';
import { CartStore } from '../cart.store';

/** CartConflictSheet — asks whether to empty a cart of another business. */
@Component({
  selector: 'app-cart-conflict-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaBottomSheet, LumaButton],
  template: `
    <app-luma-bottom-sheet
      *transloco="let t"
      titleId="cart-conflict-title"
      [open]="pending() !== null"
      [title]="t('cart.conflict.title')"
      (closed)="actions.cancelReplace()"
    >
      <p class="m-0 mb-4 text-body text-fg-muted">
        {{ t('cart.conflict.description', { current: cart.businessName() ?? '', next: pending()?.businessName ?? '' }) }}
      </p>
      <div class="flex flex-col gap-3">
        <app-luma-button [fullWidth]="true" (clicked)="actions.confirmReplace()">{{
          t('cart.conflict.confirm')
        }}</app-luma-button>
        <app-luma-button variant="ghost" [fullWidth]="true" (clicked)="actions.cancelReplace()">{{
          t('cart.conflict.cancel')
        }}</app-luma-button>
      </div>
    </app-luma-bottom-sheet>
  `,
})
export class CartConflictSheet {
  protected readonly actions = inject(CartActions);
  protected readonly cart = inject(CartStore);
  protected readonly pending = computed(() => this.actions.pendingConflict());
}
