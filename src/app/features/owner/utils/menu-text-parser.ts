import type { DraftItem } from '../services/menu-scan.repository';

// Same bounds as the scanner draft and menu_items.
const MAX_NAME = 80;
const MAX_SECTION = 40;
const MAX_DESCRIPTION = 300;
const MAX_ITEMS = 200;
const THOUSAND = 1000;
/** "PAN" is a section; "OK" is not. */
const MIN_SECTION_LETTERS = 3;

/**
 * A price at the end of a line: "15.000", "$ 6.500", "12,000", "15000",
 * "15 mil", "15k", optionally followed by "COP" or "pesos".
 */
const PRICE_AT_END =
  /(?:^|[\s.·…_:\-–—|$])\$?\s*(\d{1,3}(?:[.,\s]\d{3})+|\d{1,9})\s*(mil|k)?\s*(?:cop|pesos)?\s*$/i;
/** Leaders between a name and its price: dots, dashes, colons, pipes, dollar signs. */
const LEADERS = /[\s.·…_:\-–—|$]+$/;
const BULLET = /^\s*(?:[-•*·]|\d{1,2}[.)])\s+/;
const HAS_LETTER = /\p{L}/u;

/**
 * MenuTextParser — the free plan B of "Escanear mi menú": the owner pastes
 * the menu as text and it becomes the same draft the scanner produces.
 * Lines like "Hamburguesa clásica ........ 15.000" or "Jugo natural -
 * $6.500" are products; lines in CAPITALS or ending with ":" are sections;
 * a line without a price right after a product is its description. Runs on
 * the device: nothing is sent anywhere.
 */
export class MenuTextParser {
  /** The draft items of a pasted menu, in order (at most 200). */
  public static parse(text: string): DraftItem[] {
    const items: DraftItem[] = [];
    let section: string | null = null;
    for (const raw of text.split(/\r?\n/)) {
      if (items.length >= MAX_ITEMS) break;
      const line = raw.replace(BULLET, '').replace(/\s+/g, ' ').trim();
      if (!HAS_LETTER.test(line)) continue;
      const priced = MenuTextParser.priced(line);
      if (priced) {
        items.push({ name: priced.name, price_cop: priced.price, section, description: null });
      } else if (MenuTextParser.isSection(line)) {
        section = MenuTextParser.sectionName(line);
      } else {
        const last = items.at(-1);
        // Right under a product, a line without a price describes it.
        if (last && last.description === null && last.price_cop !== null && /^[\p{Ll}(]/u.test(line)) {
          items[items.length - 1] = { ...last, description: line.slice(0, MAX_DESCRIPTION) };
        } else {
          items.push({ name: line.slice(0, MAX_NAME), price_cop: null, section, description: null });
        }
      }
    }
    return items;
  }

  /** "Jugo natural - $6.500" → name and whole pesos; null without a price or a name. */
  private static priced(line: string): { name: string; price: number } | null {
    const match = line.match(PRICE_AT_END);
    if (!match || match.index === undefined) return null;
    const name = line.slice(0, match.index).replace(LEADERS, '').trim();
    if (!HAS_LETTER.test(name)) return null;
    const digits = Number(match[1].replace(/[.,\s]/g, ''));
    const price = match[2] ? digits * THOUSAND : digits;
    return price > 0 ? { name: name.slice(0, MAX_NAME), price } : null;
  }

  private static isSection(line: string): boolean {
    if (line.endsWith(':')) return true;
    const letters = line.replace(/[^\p{L}]/gu, '');
    return letters.length >= MIN_SECTION_LETTERS && letters === letters.toLocaleUpperCase('es-CO');
  }

  /** "BEBIDAS CALIENTES:" → "Bebidas calientes". */
  private static sectionName(line: string): string {
    const plain = line.replace(/:+$/, '').trim().toLocaleLowerCase('es-CO');
    return (plain.charAt(0).toLocaleUpperCase('es-CO') + plain.slice(1)).slice(0, MAX_SECTION);
  }
}
