import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaIconButton } from '@design-system';
import { CartActions } from '../cart-actions.service';
import { CartFlight } from '../cart-flight.service';
import { MAX_PER_ITEM, type CartProduct } from '../cart.model';
import { CartStore } from '../cart.store';

/**
 * AddToCart — "Agregar" for one product, then a − / quantity / + stepper
 * once it is in the cart.
 */
@Component({
  selector: 'app-add-to-cart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaIconButton],
  template: `
    <ng-container *transloco="let t">
      @if (quantity() === 0) {
      <app-luma-button size="sm" (clicked)="add()">{{ t('cart.add') }}</app-luma-button>
      } @else {
      <div
        class="inline-flex items-center gap-1 rounded-md border border-border bg-surface"
        role="group"
        [attr.aria-label]="t('cart.quantityOf', { name: product().name })"
      >
        <app-luma-icon-button
          icon="minus"
          variant="ghost"
          [label]="t('cart.decrease', { name: product().name })"
          (clicked)="decrease()"
        />
        <span class="min-w-6 text-center text-title text-fg" aria-live="polite">{{ quantity() }}</span>
        <app-luma-icon-button
          icon="plus"
          variant="ghost"
          [label]="t('cart.increase', { name: product().name })"
          [disabled]="atLimit()"
          (clicked)="add()"
        />
      </div>
      }
    </ng-container>
  `,
  host: { class: 'inline-flex' },
})
export class AddToCart {
  private readonly cart = inject(CartStore);
  private readonly actions = inject(CartActions);
  private readonly flight = inject(CartFlight);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  public readonly product = input.required<CartProduct>();

  protected readonly quantity = computed(() => this.cart.quantityOf(this.product().menuItemId));
  protected readonly atLimit = computed(() => this.quantity() >= MAX_PER_ITEM);

  protected add(): void {
    const before = this.quantity();
    this.actions.add(this.product());
    if (this.quantity() > before) this.flight.fly(this.host.nativeElement);
  }

  protected decrease(): void {
    this.cart.setQuantity(this.product().menuItemId, this.quantity() - 1);
  }
}
