import { describe, expect, it } from 'vitest';
import type { MyData } from '../services/data-export.service';
import { DataReport, type Translate } from './data-report';

const WORDS: Record<string, string> = {
  'account.data.fields.email': 'Correo',
  'account.data.yes': 'Sí',
  'orders.status.picked_up': 'Recogido',
  'payments.status.approved': 'Pagado en línea',
  'account.data.paymentMethod.online': 'En línea',
  'verification.status.approved': 'Verificado',
  'account.data.none': 'Nada',
  'account.data.sections.orders': 'Pedidos',
};
const t: Translate = (key) => WORDS[key] ?? key;

const DATA: MyData = {
  exported_at: '2026-11-06T15:00:00Z',
  account: { email: 'ana@example.test', created_at: '2026-01-02T05:00:00Z' },
  profile: { notify_orders: true, phone: null, residence_city: 'Pasto' },
  favorites: [{ business: 'Doña Rosa', created_at: '2026-10-01T15:00:00Z' }],
  reviews: [{ business: 'Doña Rosa', rating: 5, comment: 'Rico', created_at: '2026-10-02T15:00:00Z' }],
  reports: [],
  orders: [{
    business: 'Doña Rosa', status: 'picked_up', payment_method: 'online', payment_status: 'approved', total_cop: 20000,
    notes: null, pickup_at: null, created_at: '2026-11-06T02:30:00Z',
    items: [{ name: 'Tinto', quantity: 2, unit_price_cop: 10000 }],
  }],
  notifications: [{ type: 'payment', status: 'approved', business: 'Doña Rosa', created_at: '2026-10-03T15:00:00Z', read_at: null }],
  devices: 1,
  businesses: [{ name: 'Mi local', category: 'Café', address: 'Calle 1', phone: null, verification_status: 'approved', legal: null, menu_items: 3 }],
};

describe('DataReport', () => {
  const report = new DataReport(t, 'es-CO');
  const section = (key: string) => report.sections(DATA).find((s) => s.key === key)!;

  it('orders: business by name, translated state, pesos and Colombian time', () => {
    const line = section('orders').lines[0]!;
    expect(line).toContain('Doña Rosa');
    expect(line).toContain('Recogido');
    expect(line).toContain('$20.000');
    expect(line).toContain('Pagado en línea');
    expect(line).toContain('2 × Tinto ($10.000)');
    // 02:30 UTC on the 6th is 21:30 on the 5th in Bogotá.
    expect(line).toMatch(/^5 .*nov.*9:30/);
  });

  it('account: known fields named, unknown ones readable, empty ones out, booleans in words', () => {
    const lines = section('account').lines;
    expect(lines).toContain('Correo: ana@example.test');
    expect(lines).toContain('notify orders: Sí');
    expect(lines.join()).not.toContain('phone');
  });

  it('never shows an id or a raw ISO date', () => {
    const text = report.text(DATA);
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('the file has every section, and says when one is empty', () => {
    const text = report.text({ ...DATA, orders: [] });
    expect(text).toContain('Pedidos (0)');
    expect(text).toContain('- Nada');
    expect(text).toContain('Mi local');
  });
});
