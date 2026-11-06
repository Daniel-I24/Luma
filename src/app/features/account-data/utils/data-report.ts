import { CopFormat } from '@shared/format/cop-currency.pipe';
import { DateFormat } from '@shared/format/date-format';
import type { MyData, MyOrder } from '../services/data-export.service';

/** Translates a key; `null` when it has no translation, so the raw text is shown instead. */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

/** One block of the summary and of the file. */
export interface ReportSection {
  readonly key: string;
  readonly count: number;
  readonly lines: readonly string[];
}

const SEP = ' · ';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;
const F = 'account.data.fields.';

/**
 * DataReport — the copy of the account as a person reads it: dates in Colombian
 * time, amounts in pesos, states translated, businesses by name. The summary and
 * the file come from the same sections.
 */
export class DataReport {
  public constructor(
    private readonly t: Translate,
    private readonly lang: string,
  ) {}

  /** Every section; the ones without data still say so with their count. */
  public sections(data: MyData): readonly ReportSection[] {
    const section = (key: string, lines: readonly string[], count = lines.length): ReportSection => ({ key, count, lines });
    return [
      section('account', this.fields({ ...data.account, ...data.profile }), 1),
      section('orders', data.orders.map((o) => this.order(o))),
      section('favorites', data.favorites.map((f) => this.join(f.business, this.date(f.created_at)))),
      section('reviews', data.reviews.map((r) => this.join(r.business, `${r.rating}/5`, r.comment, this.date(r.created_at)))),
      section('notifications', data.notifications.map((n) => this.join(
        this.date(n.created_at), this.t(`account.data.notificationType.${n.type}`), n.business, n.read_at ? null : this.t('account.data.unread'),
      ))),
      section('reports', data.reports.map((r) => this.join(r.business, r.reason, r.comment))),
      section('businesses', data.businesses.map((b) => this.join(
        b.name, b.category, b.address, b.phone, this.t(`verification.status.${b.verification_status}`), b.legal?.legal_name, b.legal?.tax_id,
      ))),
      section('devices', [this.t('account.data.devicesLine', { count: data.devices })], data.devices),
    ];
  }

  /** The whole file: a title, when it was made and every section with all its lines. */
  public text(data: MyData): string {
    const blocks = this.sections(data).map((s) => [
      `${this.t(`account.data.sections.${s.key}`)} (${s.count})`,
      ...(s.lines.length ? s.lines.map((line) => `- ${line}`) : [`- ${this.t('account.data.none')}`]),
    ].join('\n'));
    return [this.t('account.data.fileTitle'), this.t('account.data.fileMade', { date: this.date(data.exported_at) }), '', ...blocks.flatMap((b) => [b, ''])].join('\n');
  }

  private order(order: MyOrder): string {
    const items = order.items.map((i) => `${i.quantity} × ${i.name} (${CopFormat.formatCop(i.unit_price_cop)})`).join(', ');
    return this.join(
      this.date(order.created_at), order.business, this.t(`orders.status.${order.status}`), CopFormat.formatCop(order.total_cop),
      this.t(`account.data.paymentMethod.${order.payment_method}`),
      order.payment_status === 'none' ? null : this.t(`payments.status.${order.payment_status}`),
      items, order.notes,
    );
  }

  /** Every field the account holds, with a name a person understands; empty ones are left out. */
  private fields(values: Readonly<Record<string, unknown>>): string[] {
    return Object.entries(values)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${this.label(key)}: ${this.value(value)}`);
  }

  private label(key: string): string {
    const translated = this.t(`${F}${key}`);
    return translated === `${F}${key}` ? key.replace(/_/g, ' ') : translated;
  }

  private value(value: unknown): string {
    if (typeof value === 'boolean') return this.t(value ? 'account.data.yes' : 'account.data.no');
    if (typeof value === 'string' && ISO_DATE.test(value)) return this.date(value);
    return String(value);
  }

  private date(iso: string): string {
    return DateFormat.formatColombia(iso, this.lang);
  }

  private join(...parts: readonly (string | null | undefined)[]): string {
    return parts.filter((part) => part).join(SEP);
  }
}
