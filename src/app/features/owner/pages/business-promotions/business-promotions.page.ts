import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
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
import type { PromotionIdea } from '@shared/promotions/advisor/promotion-idea';
import { IdeasCard } from '../../components/ideas-card/ideas-card';
import { PanelHeader } from '../../components/panel-header/panel-header';
import { PanelStateView } from '../../components/panel-state/panel-state';
import type { PromotionPrefill } from '../../components/promotion-form/promotion-draft';
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
    IdeasCard,
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
  /** A Luma IA idea opened in the form (the owner reviews and saves it). */
  protected readonly prefill = signal<PromotionPrefill | null>(null);
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
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
    // "Crear promoción" from the Summary arrives as ?item=&percent=&days=.
    const item = this.promos.items().find((i) => i.id === this.query.get('item'));
    const percent = Number(this.query.get('percent'));
    const days = Number(this.query.get('days'));
    if (item && percent && days) this.fromIdea(item.id, item.name, percent, days);
  }

  protected openIdea(idea: PromotionIdea): void {
    this.fromIdea(idea.menu_item_id, idea.item_name, idea.discount_percent, idea.duration_days);
  }

  private fromIdea(menuItemId: string, name: string, percent: number, days: number): void {
    const title = this.transloco.translate('owner.ideas.promoTitle', { percent, item: name });
    this.promos.clearError();
    this.prefill.set({
      title: title.slice(0, 80),
      menuItemId,
      discountPercent: percent,
      durationDays: days,
    });
    this.editing.set(null);
  }

  protected itemName(promotion: Promotion): string {
    return this.promos.items().find((i) => i.id === promotion.menu_item_id)?.name ?? '';
  }

  protected when(iso: string): string {
    return formatDateTime(iso, this.lang());
  }

  protected openForm(promotion: Promotion | null): void {
    this.promos.clearError();
    this.prefill.set(null);
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
