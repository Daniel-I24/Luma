import type { AccountProfile } from './account-profile.repository';

/**
 * Version of the welcome tutorial (profiles.onboarding_seen_version). Raise
 * it when the slides change and every user sees the new ones once.
 */
export const ONBOARDING_VERSION = 1;

/** Route of the tutorial; the Profile links to it to watch it again. */
export const ONBOARDING_PATH = '/welcome';

/** Onboarding — whether a profile still has to see the tutorial. */
export class Onboarding {
  public static needsOnboarding(profile: AccountProfile | null): boolean {
    return !!profile && profile.onboardingSeenVersion < ONBOARDING_VERSION;
  }
}

