import type { ReviewRequirement } from '@shared/business/verification/verification.model';

type VerificationStepId = 'business' | 'operation' | 'legal';

/** One of the three steps of "Verifica tu negocio": its requirements and whether they are met. */
export interface VerificationStep {
  readonly id: VerificationStepId;
  readonly requirements: readonly ReviewRequirement[];
  readonly missing: readonly ReviewRequirement[];
  readonly done: boolean;
}

/** The requirements of submit_business_for_review, grouped in the order the owner meets them. */
const STEPS: readonly (readonly [VerificationStepId, readonly ReviewRequirement[]])[] = [
  ['business', ['name', 'category', 'address', 'location', 'phone']],
  ['operation', ['open_day', 'available_item']],
  ['legal', ['legal', 'doc_rut', 'doc_facade']],
];

/** VerificationSteps — the three steps and where the owner is. */
export class VerificationSteps {
  /** The steps with what each one still misses. */
  public static of(missing: readonly ReviewRequirement[]): VerificationStep[] {
    return STEPS.map(([id, requirements]) => {
      const left = requirements.filter((requirement) => missing.includes(requirement));
      return { id, requirements, missing: left, done: left.length === 0 };
    });
  }

  /** "Paso N de 3": the first step not done (the last one when all are). */
  public static current(steps: readonly VerificationStep[]): number {
    const next = steps.findIndex((step) => !step.done);
    return next === -1 ? steps.length : next + 1;
  }
}
