import type { OwnerBusinessScreen, OwnerSection } from '@shared/account/owner-paths';
import type {
  Business,
  BusinessHours,
  VerificationStatus,
} from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';
import {
  REVIEW_REQUIREMENTS,
  type LegalInfo,
  type ReviewRequirement,
  type VerificationDoc,
} from '@shared/business/verification/verification.model';

/** Owners edit legal data and documents only while the database allows it. */
export const EDITABLE_STATUSES: readonly VerificationStatus[] = ['draft', 'rejected'];

export interface ReviewInputs {
  readonly business: Pick<
    Business,
    'name' | 'category' | 'address' | 'latitude' | 'longitude' | 'phone'
  >;
  readonly hours: readonly Pick<BusinessHours, 'is_closed'>[];
  readonly items: readonly Pick<MenuItem, 'is_available'>[];
  readonly legal: LegalInfo | null;
  readonly docs: readonly Pick<VerificationDoc, 'kind'>[];
}

/**
 * What is still missing before "Enviar a revisión", mirroring
 * submit_business_for_review (the server decides; this only guides).
 */
export function missingForReview(inputs: ReviewInputs): ReviewRequirement[] {
  const { business: b, hours, items, legal, docs } = inputs;
  const met: Record<ReviewRequirement, boolean> = {
    name: b.name.trim().length >= 2,
    category: b.category.trim() !== '',
    address: b.address.trim().length >= 5,
    location:
      Number.isFinite(b.latitude) &&
      Number.isFinite(b.longitude) &&
      !(b.latitude === 0 && b.longitude === 0),
    phone: b.phone !== null,
    open_day: hours.some((day) => !day.is_closed),
    available_item: items.some((item) => item.is_available),
    legal: legal !== null,
    doc_rut: docs.some((doc) => doc.kind === 'rut'),
    doc_facade: docs.some((doc) => doc.kind === 'facade'),
  };
  return REVIEW_REQUIREMENTS.filter((requirement) => !met[requirement]);
}

export type RequirementStep =
  | { readonly kind: 'section'; readonly section: OwnerSection }
  | { readonly kind: 'screen'; readonly screen: OwnerBusinessScreen };

/** Where each missing requirement is fixed. */
export const REQUIREMENT_STEP: Readonly<Record<ReviewRequirement, RequirementStep>> = {
  name: { kind: 'screen', screen: 'info' },
  category: { kind: 'screen', screen: 'info' },
  address: { kind: 'screen', screen: 'info' },
  location: { kind: 'screen', screen: 'info' },
  phone: { kind: 'screen', screen: 'info' },
  open_day: { kind: 'screen', screen: 'hours' },
  available_item: { kind: 'section', section: 'menu' },
  legal: { kind: 'screen', screen: 'verification' },
  doc_rut: { kind: 'screen', screen: 'verification' },
  doc_facade: { kind: 'screen', screen: 'verification' },
};
