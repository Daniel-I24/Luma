import {
  Injectable,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { OpeningHours } from '@shared/business/domain/opening-hours';
import type { BusinessHours } from '@shared/business/models/business.model';
import { CartStore } from '@shared/cart/cart.store';
import { PollWhileVisible } from '@shared/ui/poll-while-visible';
import { PickupSlots } from '../utils/pickup-slots';
import { type PickupChoice, type PickupOption, PickupTime } from '../utils/pickup-time';

/** How often "now" is re-read, so "Ahora" and the slots follow the clock. */
const CLOCK_TICK_MS = 60_000;

export type ScheduleState = 'loading' | 'ready' | 'error';

/**
 * PickupScheduleStore — the business hours of the cart's business and what
 * they allow: "Ahora" only while it is open, and for "Más tarde" / "Mañana"
 * only times inside that day's hours (midnight-crossing hours included).
 * Must be provided by a component (it ticks while the screen is visible).
 */
@Injectable()
export class PickupScheduleStore {
  private readonly businesses = inject(BusinessRepository);
  private readonly cart = inject(CartStore);

  private readonly _hours = signal<readonly BusinessHours[] | null>(null);
  private readonly _state = signal<ScheduleState>('loading');
  private readonly now = signal(new Date());
  public readonly state = this._state.asReadonly();

  /** True/false once the hours are known; null while loading or on error. */
  public readonly openNow = computed(() => {
    const hours = this._hours();
    return hours ? OpeningHours.from(hours).isOpenAt(this.now()) : null;
  });

  /** "Ahora" by default, moved to "Más tarde" when the business is closed. */
  public readonly option = linkedSignal<boolean | null, PickupOption>({
    source: this.openNow,
    computation: (open, previous) => {
      const current = previous?.value ?? 'now';
      return open === false && current === 'now' ? 'later' : current;
    },
  });

  public readonly slots = computed(() => {
    const hours = this._hours();
    const option = this.option();
    if (!hours || option === 'now') return [];
    const day = new Date(this.now());
    if (option === 'tomorrow') day.setDate(day.getDate() + 1);
    return PickupSlots.pickupSlots(hours, day, this.now());
  });
  public readonly ranges = computed(() => PickupSlots.slotRanges(this.slots()).join(', '));

  /** Selected "HH:MM": kept while still offered, else the first slot. */
  public readonly time = linkedSignal<readonly string[], string>({
    source: this.slots,
    computation: (slots, previous) =>
      previous && slots.includes(previous.value) ? previous.value : (slots[0] ?? ''),
  });

  constructor() {
    PollWhileVisible.pollWhileVisible(() => this.now.set(new Date()), CLOCK_TICK_MS);
    effect(() => {
      const businessId = this.cart.businessId();
      if (businessId) untracked(() => void this.load(businessId));
    });
  }

  /** Loads the opening hours that define the pick-up times. */
  public async load(businessId: string): Promise<void> {
    this._state.set('loading');
    const result = await this.businesses.getHours(businessId);
    this._hours.set(result.data);
    this._state.set(result.data ? 'ready' : 'error');
  }

  /** The pick-up to send, or why it is not valid (the lead is re-checked against the real now). */
  public choice(): PickupChoice {
    const now = new Date();
    if (this.option() === 'now') {
      return this.openNow() === false
        ? { pickupAt: null, errorKey: 'checkout.errors.closedNow' }
        : PickupTime.resolvePickup('now', '', now);
    }
    if (!this.slots().includes(this.time())) {
      return { pickupAt: null, errorKey: 'checkout.errors.outsideHours' };
    }
    return PickupTime.resolvePickup(this.option(), this.time(), now);
  }
}
