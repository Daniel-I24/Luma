import { describe, expect, it } from 'vitest';
import type { ReviewRequirement } from '@shared/business/verification/verification.model';
import { SetupSteps } from './setup-steps';

const missing = (...items: ReviewRequirement[]) => new Set<ReviewRequirement>(items);

describe('SetupSteps', () => {
  it('resumes at the first step with something missing', () => {
    expect(SetupSteps.current(missing('open_day', 'legal'))?.id).toBe('hours');
    expect(SetupSteps.current(missing('location'))?.id).toBe('location');
    expect(SetupSteps.current(missing())).toBeNull();
  });

  it('counts only required steps; contact is optional', () => {
    expect(SetupSteps.progress(missing())).toBe(1);
    expect(SetupSteps.progress(missing('available_item'))).toBeCloseTo(4 / 5);
    const contact = SetupSteps.ALL.find((s) => s.id === 'contact')!;
    expect(SetupSteps.status(contact, missing('name'))).toBe('optional');
  });

  it('every step links into the business panel', () => {
    expect(SetupSteps.ALL.map((s) => s.link('b1'))).toEqual([
      ['/owner', 'b1', 'business', 'info'], ['/owner', 'b1', 'business', 'info'], ['/owner', 'b1', 'business', 'hours'],
      ['/owner', 'b1', 'business', 'contact'], ['/owner', 'b1', 'business', 'verification'], ['/owner', 'b1', 'menu'],
    ]);
  });
});
