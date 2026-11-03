/** What the highlighted control asks for: "Toca aquí", "Escribe aquí" or "Mira aquí". */
type TourAction = 'tap' | 'type' | 'look';

/**
 * One step of a guided tour: the control it points at (an element with
 * data-tour="<anchor>") and its texts under tours.<tour>.<key>.{title,body}.
 */
export interface TourStep {
  readonly anchor: string;
  readonly key: string;
  readonly action: TourAction;
}

export type TourId =
  | 'map' | 'discover' | 'orders' | 'ai' | 'profile' | 'checkout'
  | 'owner-summary' | 'owner-orders' | 'owner-menu' | 'owner-promotions' | 'owner-business';

/** TourRegistry — the guide of each section, over its real controls. */
export const TOURS: Readonly<Record<TourId, readonly TourStep[]>> = {
  map: [
    { anchor: 'map-search', key: 'search', action: 'type' },
    { anchor: 'map-filters', key: 'filters', action: 'tap' },
    { anchor: 'map-nearby', key: 'nearby', action: 'look' },
  ],
  discover: [
    { anchor: 'feed-card', key: 'card', action: 'look' },
    { anchor: 'feed-actions', key: 'actions', action: 'tap' },
  ],
  orders: [
    { anchor: 'orders-list', key: 'list', action: 'look' },
    { anchor: 'orders-status', key: 'status', action: 'look' },
  ],
  ai: [
    { anchor: 'ai-moods', key: 'moods', action: 'tap' },
    { anchor: 'ai-results', key: 'results', action: 'look' },
  ],
  profile: [
    { anchor: 'profile-name', key: 'name', action: 'type' },
    { anchor: 'profile-notifications', key: 'notifications', action: 'tap' },
    { anchor: 'profile-help', key: 'help', action: 'tap' },
  ],
  checkout: [
    { anchor: 'checkout-when', key: 'when', action: 'tap' },
    { anchor: 'checkout-notes', key: 'notes', action: 'type' },
    { anchor: 'checkout-payment', key: 'payment', action: 'tap' },
  ],
  'owner-summary': [
    { anchor: 'owner-stats', key: 'stats', action: 'look' },
    { anchor: 'owner-publish', key: 'publish', action: 'tap' },
    { anchor: 'owner-pause', key: 'pause', action: 'tap' },
  ],
  'owner-orders': [
    { anchor: 'owner-order-tabs', key: 'tabs', action: 'tap' },
    { anchor: 'owner-order-card', key: 'card', action: 'tap' },
  ],
  'owner-menu': [
    { anchor: 'menu-scan', key: 'scan', action: 'tap' },
    { anchor: 'menu-add', key: 'add', action: 'tap' },
    { anchor: 'menu-item', key: 'item', action: 'tap' },
  ],
  'owner-promotions': [
    { anchor: 'promo-add', key: 'add', action: 'tap' },
    { anchor: 'promo-limit', key: 'limit', action: 'look' },
  ],
  'owner-business': [
    { anchor: 'business-sections', key: 'sections', action: 'tap' },
    { anchor: 'business-appearance', key: 'appearance', action: 'tap' },
  ],
};

/** "/owner/:id/:section" has three parts. */
const OWNER_SECTION_PARTS = 3;
const OWNER_TOURS: Readonly<Record<string, TourId>> = {
  summary: 'owner-summary', orders: 'owner-orders', menu: 'owner-menu', promotions: 'owner-promotions',
  business: 'owner-business',
};
const CUSTOMER_TOURS: Readonly<Record<string, TourId>> = {
  map: 'map', feed: 'discover', orders: 'orders', ai: 'ai', profile: 'profile', checkout: 'checkout',
};

/** TourRoutes — which guide belongs to the screen at a URL. */
export class TourRoutes {
  /** The tour of the screen at a URL, or null (detail screens have none). */
  public static tourForUrl(url: string): TourId | null {
    const parts = url.split(/[?#]/)[0].split('/').filter(Boolean);
    if (parts[0] === 'owner') {
      return parts.length === OWNER_SECTION_PARTS && parts[1] !== 'new' ? (OWNER_TOURS[parts[2]] ?? null) : null;
    }
    return parts.length === 1 ? (CUSTOMER_TOURS[parts[0]] ?? null) : null;
  }
}
