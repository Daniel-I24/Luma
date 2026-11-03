import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon, LumaIconButton, LumaImage } from '@design-system';
import type { MenuItem } from '@shared/business/models/menu.model';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { ScanPrices } from '../../state/menu-scan.store';

/** A name or price typed in the row, already checked. */
export type InlineChange = Partial<Pick<MenuItem, 'name' | 'price_cop'>>;

const MIN_NAME = 2;

/**
 * MenuItemRow — one product of the owner's menu, editable in place: name and
 * price, "Disponible/Agotado", up/down and the drag handle; the pencil opens
 * the full form (photo, description, section). Agotado hides the product from
 * customers until it is available again.
 */
@Component({
  selector: 'app-menu-item-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIcon, LumaIconButton, LumaImage, CopCurrencyPipe],
  templateUrl: './menu-item-row.html',
  host: { '[attr.data-menu-item]': 'item().id', class: 'block' },
})
export class MenuItemRow {
  private readonly document = inject(DOCUMENT);

  public readonly item = input.required<MenuItem>();
  public readonly first = input(false);
  public readonly last = input(false);
  public readonly busy = input(false);
  /** Highlighted while another row is dragged over this one. */
  public readonly dropTarget = input(false);

  public readonly changed = output<InlineChange>();
  public readonly availability = output<boolean>();
  public readonly moveUp = output<void>();
  public readonly moveDown = output<void>();
  public readonly edit = output<void>();
  public readonly remove = output<void>();
  /** While dragging: the row under the pointer (null when none). */
  public readonly dragOver = output<string | null>();
  /** Dropped on another row of the section. */
  public readonly dropOn = output<string>();

  protected readonly priceError = signal(false);
  protected readonly dragging = signal(false);

  protected onName(event: Event): void {
    const input = event.target as HTMLInputElement;
    const name = input.value.trim();
    if (name.length < MIN_NAME) {
      input.value = this.item().name;
      return;
    }
    if (name !== this.item().name) this.changed.emit({ name });
  }

  protected onPrice(event: Event): void {
    const price = ScanPrices.priceOf((event.target as HTMLInputElement).value);
    this.priceError.set(price === null);
    if (price !== null && price !== this.item().price_cop) this.changed.emit({ price_cop: price });
  }

  protected startDrag(event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.dragging.set(true);
  }

  protected onDrag(event: PointerEvent): void {
    if (this.dragging()) this.dragOver.emit(this.rowAt(event));
  }

  protected endDrag(event: PointerEvent): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    const target = this.rowAt(event);
    this.dragOver.emit(null);
    if (target) this.dropOn.emit(target);
  }

  /** Another product row under the pointer, if any. */
  private rowAt(event: PointerEvent): string | null {
    const row = this.document.elementFromPoint?.(event.clientX, event.clientY)?.closest<HTMLElement>('[data-menu-item]');
    const id = row?.dataset['menuItem'] ?? null;
    return id && id !== this.item().id ? id : null;
  }
}
