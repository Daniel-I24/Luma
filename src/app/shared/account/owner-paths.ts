/** Tabs of Luma Negocios, under /owner/:businessId. */
export const OWNER_SECTIONS = ['summary', 'orders', 'menu', 'promotions', 'business'] as const;
export type OwnerSection = (typeof OWNER_SECTIONS)[number];

/** Screens reached from "Mi negocio" (/owner/:id/business/...). */
export type OwnerBusinessScreen = 'info' | 'hours' | 'verification';

/** At most this many businesses per owner (enforced by the database too). */
export const MAX_OWNED_BUSINESSES = 3;

/**
 * Links into Luma Negocios, shared by the features that point there
 * (Profile, notifications, the owner shell itself).
 */
export const ownerPaths = {
  home: (): string[] => ['/owner'],
  register: (): string[] => ['/owner', 'new'],
  section: (businessId: string, section: OwnerSection): string[] => ['/owner', businessId, section],
  screen: (businessId: string, screen: OwnerBusinessScreen): string[] => [
    '/owner',
    businessId,
    'business',
    screen,
  ],
};
