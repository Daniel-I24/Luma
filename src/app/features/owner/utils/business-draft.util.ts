import type { Business } from '@shared/business/models/business.model';
import type { GeoCoords } from '@shared/geo/geolocation.service';

/** What the business forms edit; strings as typed, location null until chosen. */
export interface BusinessDraft {
  name: string;
  category: string;
  phone: string;
  address: string;
  location: GeoCoords | null;
}

export const EMPTY_DRAFT: BusinessDraft = {
  name: '',
  category: '',
  phone: '',
  address: '',
  location: null,
};

export function draftFrom(business: Business): BusinessDraft {
  return {
    name: business.name,
    category: business.category,
    phone: business.phone ?? '',
    address: business.address,
    location: { lat: business.latitude, lng: business.longitude },
  };
}

/** Values to validate: empty phone means none; a missing location fails validation. */
export function draftValues(draft: BusinessDraft): Record<string, unknown> {
  return {
    name: draft.name,
    category: draft.category,
    phone: draft.phone.trim() || null,
    address: draft.address,
    latitude: draft.location?.lat,
    longitude: draft.location?.lng,
  };
}

/** Form order of the basic fields, with the id of the element that takes the focus. */
export function basicsFieldOrder(prefix: string): (readonly [string, string])[] {
  return [
    ['name', `${prefix}-name`],
    ['category', `${prefix}-category`],
    ['phone', `${prefix}-phone`],
    ['address', `${prefix}-address`],
    ['latitude', `${prefix}-location`],
    ['longitude', `${prefix}-location`],
  ];
}

/** Field order of the information form: the basics, then description and preparation time. */
export function infoFieldOrder(prefix: string): (readonly [string, string])[] {
  return [
    ...basicsFieldOrder(prefix),
    ['description', `${prefix}-description`],
    ['prep_minutes', `${prefix}-prep`],
  ];
}
