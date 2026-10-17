import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import {
  LumaButton,
  LumaChip,
  LumaEmptyState,
  LumaIcon,
  LumaIconButton,
  LumaInput,
} from '@design-system';
import { CartStore } from '@shared/cart/cart.store';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { CheckoutStore, NOTES_MAX_LENGTH } from './state/checkout.store';
import type { PickupOption } from './utils/pickup-time.util';

/**
 * CheckoutPage — /checkout: cart summary, "¿Cuándo recoges?" (now, later
 * today, tomorrow), notes, "Pagar al recoger" and the total. Confirming
 * creates the order and opens it.
 */
@Component({
  selector: 'app-checkout-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaButton,
    LumaChip,
    LumaEmptyState,
    LumaIcon,
    LumaIconButton,
    LumaInput,
    CopCurrencyPipe,
  ],
  providers: [CheckoutStore],
  templateUrl: './checkout.page.html',
  host: { class: 'block' },
})
export class CheckoutPage {
  protected readonly cart = inject(CartStore);
  protected readonly store = inject(CheckoutStore);
  private readonly router = inject(Router);

  protected readonly options: readonly PickupOption[] = ['now', 'later', 'tomorrow'];
  protected readonly notesMax = NOTES_MAX_LENGTH;

  protected onNotes(event: Event): void {
    this.store.notes.set((event.target as HTMLTextAreaElement).value);
  }

  protected back(): void {
    void this.router.navigate(['/cart']);
  }

  protected explore(): void {
    void this.router.navigate(['/map']);
  }
}
