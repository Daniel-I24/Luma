import { describe, expect, it } from 'vitest';
import en from '../../../../../public/i18n/en.json';
import es from '../../../../../public/i18n/es.json';
import { AuditText } from './audit-text';

/** The text of a key, or undefined when the translations lack it. */
const lookUp = (translations: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], translations);

const LOGGED = [
  { action: 'review_business', detail: 'approved' },
  { action: 'review_business', detail: 'rejected' },
  { action: 'review_business', detail: 'suspended' },
  { action: 'verify_contact', detail: 'phone' },
  { action: 'verify_contact', detail: 'instagram' },
  { action: 'void_payment', detail: null },
  { action: 'mark_refund_done', detail: null },
  { action: 'clear_strikes', detail: null },
  { action: 'reconcile_payments', detail: null },
];

describe('AuditText', () => {
  it('every action the database logs, and its detail, reads as words in Spanish and English', () => {
    for (const line of LOGGED) {
      const keys = [AuditText.actionKey(line), AuditText.detailKey(line)].filter((k): k is string => k !== null);
      for (const key of keys) {
        expect(typeof lookUp(es, key), `es ${key}`).toBe('string');
        expect(typeof lookUp(en, key), `en ${key}`).toBe('string');
      }
    }
  });

  it('"verify_contact (phone)" becomes the action and the kind of contact', () => {
    const line = { action: 'verify_contact', detail: 'phone' };
    expect(lookUp(es, AuditText.actionKey(line))).toBe('Verificación de contacto');
    expect(lookUp(es, AuditText.detailKey(line) ?? '')).toBe('Teléfono');
  });

  it('a review shows its decision, never "approved"', () => {
    expect(lookUp(es, AuditText.detailKey({ action: 'review_business', detail: 'approved' }) ?? '')).toBe('aprobado');
  });

  it('an unknown action or detail never shows raw', () => {
    expect(AuditText.actionKey({ action: 'drop_table', detail: null })).toBe('admin.operations.actions.other');
    expect(AuditText.detailKey({ action: 'review_business', detail: 'weird' })).toBeNull();
    expect(AuditText.detailKey({ action: 'void_payment', detail: 'x' })).toBeNull();
  });
});
