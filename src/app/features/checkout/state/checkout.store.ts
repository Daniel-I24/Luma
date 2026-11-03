import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NativeHaptics } from '@core/native/native-haptics';
import { TextNormalizer } from '@core/validation/text-normalizer';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { CartStore } from '@shared/cart/cart.store';
import { OrderRepository } from '@shared/orders/order.repository';
import { PaymentGatewayFactory, type PaymentMethod } from '@shared/payments/payment-gateway';
import { type PaymentConfig, PaymentRepository } from '@shared/payments/payment.repository';
import { PickupScheduleStore } from './pickup-schedule.store';
import { Residence } from '@shared/geo/residence';

export const NOTES_MAX_LENGTH = 200;
const TRUST_PENDING_KEY = 'orders.errors.trustPendingLimit';
const OPEN_STATUSES: readonly string[] = ['pending', 'accepted', 'preparing', 'ready'];

/**
 * CheckoutStore — the order being confirmed: notes, the pick-up chosen in
 * PickupScheduleStore, how it is paid and the call to create_order. Only ids
 * and quantities leave the app; the server computes the total. "Pagar en
 * línea" appears only when payment_config says so; then the order is created
 * waiting for its payment and Wompi's checkout opens in the system browser.
 */
@Injectable()
export class CheckoutStore {
  private readonly cart = inject(CartStore);
  private readonly orders = inject(OrderRepository);
  private readonly router = inject(Router);
  private readonly schedule = inject(PickupScheduleStore);
  private readonly gateways = inject(PaymentGatewayFactory);
  private readonly payments = inject(PaymentRepository);
  private readonly haptics = inject(NativeHaptics);
  private readonly businesses = inject(BusinessRepository);
  private readonly session = inject(SessionProfileStore);

  public readonly notes = signal('');
  public readonly method = signal<PaymentMethod>('pay_at_pickup');

  private readonly _config = signal<PaymentConfig>({ enabled: false, sandbox: false });
  private readonly _submitting = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  public readonly submitting = this._submitting.asReadonly();
  public readonly errorKey = this._errorKey.asReadonly();
  public readonly notesTooLong = computed(() => this.notes().length > NOTES_MAX_LENGTH);
  /** A business still in review takes pick-up payment only (orders_online_needs_approval). */
  public readonly inReview = signal(false);
  /** "Pagar en línea" is offered only when the server enables it and the business is approved. */
  public readonly onlineAvailable = computed(() => this._config().enabled && !this.inReview());
  /** Sandbox: "Modo de pruebas: no se cobra dinero real". */
  public readonly sandbox = computed(() => this._config().enabled && this._config().sandbox);
  public readonly paymentLabelKey = computed(() => this.gateways.for(this.method()).labelKey);
  /** The business is in another department than the customer's residence (a heads-up, not a rule). */
  public readonly otherDepartment = signal(false);
  /** The pay-at-pickup order that blocks a new one (trust limit), to link to it. */
  public readonly blockingOrderId = signal<string | null>(null);

  constructor() {
    void this.payments.config().then((config) => {
      this._config.set(config);
      if (!config.enabled) this.method.set('pay_at_pickup');
    });
    void this.checkRegion();
  }

  private async checkRegion(): Promise<void> {
    const businessId = this.cart.businessId();
    if (!businessId) return;
    await this.session.whenLoaded();
    const home = this.session.profile()?.residence?.departmentCode;
    const business = await this.businesses.getById(businessId);
    this.inReview.set(business.data?.verification_status === 'pending');
    if (this.inReview()) this.method.set('pay_at_pickup');
    const there = business.data?.city_dane_code ? Residence.departmentOf(business.data.city_dane_code) : null;
    this.otherDepartment.set(!!home && !!there && home !== there);
  }

  /** Creates the order and starts the chosen payment, then opens the order. */
  public async confirm(): Promise<void> {
    const businessId = this.readyToSubmit();
    if (!businessId) return;
    this._errorKey.set(null);
    this._submitting.set(true);
    try {
      await this.submit(businessId);
    } finally {
      this._submitting.set(false);
    }
  }

  /** The cart's business when the order can be sent; otherwise null (and the reason as an error). */
  private readyToSubmit(): string | null {
    if (this._submitting() || this.cart.isEmpty()) return null;
    const pickup = this.schedule.choice();
    if (pickup.errorKey || this.notesTooLong()) {
      this._errorKey.set(pickup.errorKey ?? 'orders.errors.invalidNotes');
      return null;
    }
    return this.cart.businessId();
  }

  private async submit(businessId: string): Promise<void> {
    const method = this.onlineAvailable() ? this.method() : 'pay_at_pickup';
    const result = await this.orders.create({
      businessId,
      items: this.cart.items().map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
      pickupAt: this.schedule.choice().pickupAt,
      notes: TextNormalizer.lines(this.notes()) || null,
      paymentMethod: method,
    });
    if (!result.data) {
      await this.explain(result.errorKey ?? 'orders.errors.createFailed');
      return;
    }
    this.cart.clear();
    void this.haptics.tap();
    // Online: the order screen shows the payment state and "Reintentar pago" if opening failed.
    await this.gateways.for(method).start(result.data);
    await this.router.navigate(['/orders', result.data]);
  }

  /** The trust limit only mentions paying online when payments are on, and links to the order to pick up. */
  private async explain(errorKey: string): Promise<void> {
    this.blockingOrderId.set(null);
    if (errorKey !== TRUST_PENDING_KEY) {
      this._errorKey.set(errorKey);
      return;
    }
    this._errorKey.set(this.onlineAvailable() ? 'orders.errors.trustPendingLimitOnline' : TRUST_PENDING_KEY);
    const mine = await this.orders.list();
    const open = mine.data?.find((o) => o.payment_method === 'pay_at_pickup' && OPEN_STATUSES.includes(o.status));
    this.blockingOrderId.set(open?.id ?? null);
  }
}
