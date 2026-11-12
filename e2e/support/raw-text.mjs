import { readFileSync } from 'node:fs';

/**
 * What a person must never read: a translation key ("admin.operations.actions.x",
 * a key Transloco could not find) or an internal status ("approved",
 * "picked_up"). Keys are told apart from addresses by their first part: a
 * top-level group of the translations.
 */
const GROUPS = new Set(Object.keys(JSON.parse(readFileSync(new URL('../../public/i18n/es.json', import.meta.url), 'utf8'))));
const INTERNAL = new Set([
  'approved', 'rejected', 'pending', 'suspended', 'declined', 'voided', 'refunded', 'cancelled', 'verified', 'unverified',
  'awaiting_payment', 'picked_up', 'refund_required', 'refund_pending_admin', 'duplicate_charge', 'contact_requested',
  'phone', 'website', 'verify_contact', 'review_business', 'void_payment', 'mark_refund_done', 'clear_strikes', 'reconcile_payments',
]);
const TOKEN = /[\p{L}\d_]+(?:\.[\p{L}\d_]+)*/gu;

/** Leaks in a text: keys and internal statuses, each once. */
function leaks(text) {
  const found = new Set();
  for (const [token] of text.matchAll(TOKEN)) {
    const [group] = token.split('.');
    if (token.includes('.') && GROUPS.has(group)) found.add(token);
    else if (INTERNAL.has(token)) found.add(token);
  }
  return [...found];
}

/** Leaks in what the page shows now (visible text only). */
export async function rawText(page) {
  return leaks(await page.locator('body').innerText());
}
