import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AI_MODE } from '@core/config/build-flags';
import { LumaBottomSheet, LumaButton, LumaEmptyState, LumaIcon, ToastService } from '@design-system';
import type { MenuItemInput } from '@shared/business/data/business-write.schemas';
import type { MenuItem } from '@shared/business/models/menu.model';
import type { HasUnsavedChanges } from '@shared/forms/unsaved-changes.guard';
import { MenuItemForm } from '../../components/menu-item-form/menu-item-form';
import { MenuItemRow } from '../../components/menu-item-row/menu-item-row';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import { MenuPanelStore } from '../../state/menu-panel.store';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { RouteBusinessId } from '../../utils/route-business-id';
import { SetupReturn } from '../../components/setup-return/setup-return';

/**
 * BusinessMenuPage — /owner/:id/menu: "Escanear mi menú con IA" always first
 * (with the free text plan B), then products by section edited in place
 * (name, price, Disponible/Agotado, order by up/down or drag), the full form
 * for photo and description, and delete.
 */
@Component({
  selector: 'app-business-menu-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SetupReturn,
    TranslocoModule,
    RouterLink,
    LumaBottomSheet,
    LumaButton,
    LumaEmptyState,
    LumaIcon,
    MenuItemForm,
    MenuItemRow,
    PanelHeader,
    PanelStateView,
  ],
  providers: [PanelBusinessStore, MenuPanelStore],
  templateUrl: './business-menu.page.html',
  host: { class: 'block' },
})
export class BusinessMenuPage implements HasUnsavedChanges {
  protected readonly panel = inject(PanelBusinessStore);
  protected readonly menu = inject(MenuPanelStore);
  private readonly toast = inject(ToastService);
  protected readonly id = RouteBusinessId.routeBusinessId((id) => this.load(id));
  /** Reading menu photos needs the extract-menu function (Luma IA remote); the text plan B always works. */
  protected readonly canScan = inject(AI_MODE) === 'remote';

  /** Item in the form sheet: null = new product, undefined = sheet closed. */
  protected readonly editing = signal<MenuItem | null | undefined>(undefined);
  protected readonly deleting = signal<MenuItem | null>(null);
  /** The row a dragged product is over. */
  protected readonly dropTarget = signal<string | null>(null);
  private readonly form = viewChild(MenuItemForm);

  protected async load(id = this.id()): Promise<void> {
    await Promise.all([this.panel.load(id), this.menu.load(id)]);
  }

  protected openForm(item: MenuItem | null): void {
    this.menu.clearError();
    this.editing.set(item);
  }

  protected async save(input: MenuItemInput): Promise<void> {
    const item = this.editing();
    if (item === undefined) return;
    if (await this.menu.save(this.id(), item?.id ?? null, input)) {
      this.form()?.markSaved();
      this.editing.set(undefined);
      this.toast.show({ messageKey: 'businessPanel.menu.saved', tone: 'success' });
    }
  }

  /** For the leave warning (unsavedChangesGuard). */
  public hasUnsavedChanges(): boolean {
    return this.editing() !== undefined && (this.form()?.hasChanges() ?? false);
  }

  protected async confirmDelete(): Promise<void> {
    const item = this.deleting();
    this.deleting.set(null);
    if (item && (await this.menu.remove(item.id))) {
      this.toast.show({ messageKey: 'businessPanel.menu.deleted', tone: 'success' });
    }
  }
}
