/** A menu read from photos: a draft the owner reviews before saving anything. */
export interface DraftItem {
  readonly name: string;
  readonly description: string | null;
  /** Whole COP, or null when the photo shows no readable price. */
  readonly price_cop: number | null;
  readonly section: string | null;
}

export interface MenuDraft {
  readonly items: readonly DraftItem[];
}

/** Same as the menu cap per business (business_content_limits). */
export const MAX_DRAFT_ITEMS = 200;
const MIN_PRICE_COP = 50;
const MAX_PRICE_COP = 10_000_000;

/** Plain text only: no control characters, no markup, collapsed spaces, cut to max. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
  return text.length > 0 ? text : null;
}

/**
 * Colombian prices as printed on menus: 12500, "12.500", "$ 12,500",
 * "12.500,00", "COP 8.000". Thousands separators are dots or commas; a final
 * group of 1 or 2 digits after a separator is cents and is dropped. Null when
 * unreadable or outside 50 to 10 000 000 COP.
 */
export function parseCop(value: unknown): number | null {
  let cop: number | null = null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    cop = Math.round(value);
  } else if (typeof value === 'string') {
    const raw = value.replace(/cop|\$|\s/gi, '');
    const cents = raw.match(/^(.*\d)[.,]\d{1,2}$/);
    const whole = cents ? cents[1] : raw;
    if (/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(whole)) cop = Number(whole.replace(/[.,]/g, ''));
  }
  return cop !== null && cop >= MIN_PRICE_COP && cop <= MAX_PRICE_COP ? cop : null;
}

/**
 * Turns the model's JSON into a clean draft: names 1-80, descriptions up to
 * 300, sections up to 40 characters (the menu_items limits), prices parsed,
 * duplicates (same section and name) dropped, at most 200 items. Null when
 * the shape is wrong.
 */
export function toDraft(value: unknown): MenuDraft | null {
  if (typeof value !== 'object' || value === null) return null;
  const items = (value as Record<string, unknown>).items;
  if (!Array.isArray(items)) return null;
  const seen = new Set<string>();
  const clean: DraftItem[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const raw = item as Record<string, unknown>;
    const name = cleanText(raw.name, 80);
    if (!name) continue;
    const section = cleanText(raw.section, 40);
    const key = `${section ?? ''}|${name}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({ name, description: cleanText(raw.description, 300), price_cop: parseCop(raw.price), section });
    if (clean.length === MAX_DRAFT_ITEMS) break;
  }
  return { items: clean };
}
