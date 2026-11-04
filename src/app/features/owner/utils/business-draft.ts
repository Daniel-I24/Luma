import { Phone } from '@shared/account/phone';
import type { Business } from '@shared/business/models/business.model';
import type { GeoCoords } from '@shared/geo/geolocation.service';
import type { Residence } from '@shared/geo/residence';

/** What the business forms edit; strings as typed, location null until chosen. */
export interface BusinessDraft {
  name: string;
  category: string;
  phone: string;
  address: string;
  /** Sector or neighbourhood (optional; proposed by the reverse geocoding, always editable). */
  neighborhood: string;
  /** "Al frente del parque" (optional). */
  reference: string;
  location: GeoCoords | null;
  /** Department and municipality (DANE); the city name is not stored, only its code. */
  municipality: Residence | null;
  /** The stored municipality code, until the picker turns it into `municipality`. */
  cityDaneCode: string | null;
}

export const EMPTY_DRAFT: BusinessDraft = {
  name: '',
  category: '',
  phone: '',
  address: '',
  neighborhood: '',
  reference: '',
  location: null,
  municipality: null,
  cityDaneCode: null,
};

/** BusinessDrafts — the editable draft of a business and its field order. */
export class BusinessDrafts {
  /** The editable draft of a stored business. */
  public static draftFrom(business: Business): BusinessDraft {
    return {
      name: business.name,
      category: business.category,
      phone: business.phone ? (Phone.parse(business.phone)?.display ?? business.phone) : '',
      address: business.address,
      neighborhood: business.neighborhood ?? '',
      reference: business.address_reference ?? '',
      location: { lat: business.latitude, lng: business.longitude },
      municipality: null,
      cityDaneCode: business.city_dane_code ?? null,
    };
  }

  /** Values to validate: empty phone means none; a missing location fails validation. */
  public static draftValues(draft: BusinessDraft): Record<string, unknown> {
    return {
      name: draft.name,
      category: draft.category,
      phone: draft.phone.trim() || null,
      address: draft.address,
      latitude: draft.location?.lat,
      longitude: draft.location?.lng,
      department: draft.municipality?.department ?? null,
      city_dane_code: draft.municipality?.daneCode ?? draft.cityDaneCode,
      // Only when written: the columns arrive with migration round10.
      ...(draft.neighborhood.trim() ? { neighborhood: draft.neighborhood } : {}),
      ...(draft.reference.trim() ? { address_reference: draft.reference } : {}),
    };
  }

  /** Form order of the basic fields, with the id of the element that takes the focus. */
  public static basicsFieldOrder(prefix: string): (readonly [string, string])[] {
    return [
      ['name', `${prefix}-name`],
      ['category', `${prefix}-category`],
      ['phone', `${prefix}-phone`],
      ['latitude', `${prefix}-location`],
      ['longitude', `${prefix}-location`],
      ['address', `${prefix}-address`],
      ['neighborhood', `${prefix}-neighborhood`],
      ['address_reference', `${prefix}-reference`],
    ];
  }

  /** Field order of the information form: the basics, then description and preparation time. */
  public static infoFieldOrder(prefix: string): (readonly [string, string])[] {
    return [
      ...BusinessDrafts.basicsFieldOrder(prefix),
      ['description', `${prefix}-description`],
      ['prep_minutes', `${prefix}-prep`],
    ];
  }
}

