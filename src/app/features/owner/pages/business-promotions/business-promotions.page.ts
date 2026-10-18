import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  LumaBottomSheet,
  LumaButton,
  LumaEmptyState,
  LumaIconButton,
  ToastService,
} from '@design-system';
import type { PromotionInput } from '@shared/business/data/business-write.schemas';
import type { Promotion } from '@shared/business/models/business.model';
import { formatDateTime } from '@shared/format/date-format.util';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import { PromotionForm } from '../../components/promotion-form/promotion-form';
import { PanelBusinessStore } from '../../state/panel-business.store';
import { PromotionsPanelStore } from '../../state/promotions-panel.store';
import { promotionPhase } from '../../utils/promotion-phase.util';
import { routeBusinessId } from '../../utils/route-business-id';

const PHASE_CLASS = {
  scheduled: 'bg-info-bg text-info-fg',
  running: 'bg-success-bg text-success-fg',
  ended: 'bg-canvas-muted text-fg-muted',
} as const;

/** BusinessPromotionsPage — /owner/:id/promotions: create, edit and end promotions. */
@Component({
  selector: 'app-business-promotions-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaBottomSheet,
    LumaButton,
    LumaEmptyState,
    LumaIconButton,
    PanelHeader,
    PanelStateView,
    PromotionForm,
  ],
  providers: [PanelBusinessStore, PromotionsPanelStore],
  templateUrl: './business-promotions.page.html',
  host: { class: 'block' },
})
export class BusinessPromotionsPage {
  protected readonly panel = inject(PanelBusinessStore);
  protected readonly promos = inject(PromotionsPanelStore);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  protected readonly id = routeBusinessId();

  /** Promotion in the form sheet: null = new, undefined = closed. */
  protected readonly editing = signal<Promotion | null | undefined>(undefined);
  protected readonly ending = signal<Promotion | null>(null);
  protected readonly phase = promotionPhase;
  protected readonly phaseClass = PHASE_CLASS;

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.load(id));
    });
  }

  protected async load(id = this.id()): Promise<void> {
    await Promise.all([this.panel.load(id), this.promos.load(id)]);
  }

  protected when(iso: string): string {
    return formatDateTime(iso, this.lang());
  }

  protected openForm(promotion: Promotion | null): void {
    this.promos.clearError();
    this.editing.set(promotion);
  }

  protected async save(input: PromotionInput): Promise<void> {
    const promotion = this.editing();
    if (promotion === undefined) return;
    if (await this.promos.save(this.id(), promotion?.id ?? null, input)) {
      this.editing.set(undefined);
      this.toast.show({ messageKey: 'businessPanel.promotions.saved', tone: 'success' });
    }
  }

  protected async confirmEnd(): Promise<void> {
    const promotion = this.ending();
    this.ending.set(null);
    if (promotion && (await this.promos.end(promotion))) {
      this.toast.show({ messageKey: 'businessPanel.promotions.ended', tone: 'success' });
    }
  }
}
