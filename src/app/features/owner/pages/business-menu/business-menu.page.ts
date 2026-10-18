import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import {
  LumaBottomSheet,
  LumaButton,
  LumaEmptyState,
  LumaIconButton,
  ToastService,
} from '@design-system';
import type { MenuItemInput } from '@shared/business/data/business-write.schemas';
import type { MenuItem } from '@shared/business/models/menu.model';
import { CopCurrencyPipe } from '@shared/format/cop-currency.pipe';
import { MenuItemForm } from '../../components/menu-item-form/menu-item-form';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import { MenuPanelStore } from '../../state/menu-panel.store';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { routeBusinessId } from '../../utils/route-business-id';

/** BusinessMenuPage — /owner/:id/menu: products by section, availability, edit and delete. */
@Component({
  selector: 'app-business-menu-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaBottomSheet,
    LumaButton,
    LumaEmptyState,
    LumaIconButton,
    CopCurrencyPipe,
    MenuItemForm,
    PanelHeader,
    PanelStateView,
  ],
  providers: [PanelBusinessStore, MenuPanelStore],
  templateUrl: './business-menu.page.html',
  host: { class: 'block' },
})
export class BusinessMenuPage {
  protected readonly panel = inject(PanelBusinessStore);
  protected readonly menu = inject(MenuPanelStore);
  private readonly toast = inject(ToastService);
  protected readonly id = routeBusinessId();

  /** Item in the form sheet: null = new product, undefined = sheet closed. */
  protected readonly editing = signal<MenuItem | null | undefined>(undefined);
  protected readonly deleting = signal<MenuItem | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.load(id));
    });
  }

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
      this.editing.set(undefined);
      this.toast.show({ messageKey: 'businessPanel.menu.saved', tone: 'success' });
    }
  }

  protected toggle(item: MenuItem): void {
    void this.menu.setAvailable(item, !item.is_available);
  }

  protected async confirmDelete(): Promise<void> {
    const item = this.deleting();
    this.deleting.set(null);
    if (item && (await this.menu.remove(item.id))) {
      this.toast.show({ messageKey: 'businessPanel.menu.deleted', tone: 'success' });
    }
  }
}
