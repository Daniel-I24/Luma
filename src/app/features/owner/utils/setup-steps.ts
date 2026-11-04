import { ownerPaths } from '@shared/account/account-paths';
import type { ReviewRequirement } from '@shared/business/verification/verification.model';

type SetupStepId = 'basics' | 'location' | 'hours' | 'contact' | 'legal' | 'menu';

/** One step of the business wizard and the review requirements it covers. */
export interface SetupStep {
  readonly id: SetupStepId;
  readonly requirements: readonly ReviewRequirement[];
  /** Optional steps never block "Enviar a revisión". */
  readonly optional: boolean;
  readonly link: (businessId: string) => string[];
}

export type StepStatus = 'done' | 'todo' | 'optional';

/**
 * SetupSteps — the order of the wizard of a new business. The draft is the
 * business row itself, so the wizard resumes wherever the owner left it:
 * the current step is the first one with something missing.
 */
export class SetupSteps {
  public static readonly ALL: readonly SetupStep[] = [
    { id: 'basics', requirements: ['name', 'category', 'address', 'phone'], optional: false, link: (id) => ownerPaths.screen(id, 'info') },
    { id: 'location', requirements: ['location'], optional: false, link: (id) => ownerPaths.screen(id, 'info') },
    { id: 'hours', requirements: ['open_day'], optional: false, link: (id) => ownerPaths.screen(id, 'hours') },
    { id: 'contact', requirements: [], optional: true, link: (id) => ownerPaths.screen(id, 'contact') },
    { id: 'legal', requirements: ['legal', 'doc_rut', 'doc_facade'], optional: false, link: (id) => ownerPaths.screen(id, 'verification') },
    { id: 'menu', requirements: ['available_item'], optional: false, link: (id) => ownerPaths.section(id, 'menu') },
  ];

  /** Done, current or pending, from what is still missing. */
  public static status(step: SetupStep, missing: ReadonlySet<ReviewRequirement>): StepStatus {
    if (step.optional) return 'optional';
    return step.requirements.some((r) => missing.has(r)) ? 'todo' : 'done';
  }

  /** First step with something missing; null when everything is ready for review. */
  public static current(missing: ReadonlySet<ReviewRequirement>): SetupStep | null {
    return SetupSteps.ALL.find((step) => SetupSteps.status(step, missing) === 'todo') ?? null;
  }

  /** Share of the required steps already done (0 to 1). */
  public static progress(missing: ReadonlySet<ReviewRequirement>): number {
    const required = SetupSteps.ALL.filter((step) => !step.optional);
    return required.filter((step) => SetupSteps.status(step, missing) === 'done').length / required.length;
  }
}
