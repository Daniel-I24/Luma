import { InjectionToken } from '@angular/core';

/**
 * How Luma IA runs: "rules" (in the app, no external service) or "remote"
 * (Edge Functions recommend, suggest-promotions and extract-menu with the
 * LLM gateway, falling back to the rules on any failure). The build sets it:
 * AI_MODE=remote → `ng build --define LUMA_AI_MODE='remote'`
 * (scripts/build-flags.mjs, used by build:prod and the APK). Without it the
 * app runs in rules mode (docs/ai.md, "Comprobar cada caso").
 */
export type AiMode = 'rules' | 'remote';

declare const LUMA_AI_MODE: string | undefined;

/** AiModes — the mode this bundle was built with. */
export class AiModes {
  /** "remote" only when the build defined LUMA_AI_MODE='remote'. */
  public static built(): AiMode {
    return typeof LUMA_AI_MODE !== 'undefined' && LUMA_AI_MODE === 'remote' ? 'remote' : 'rules';
  }
}

export const AI_MODE = new InjectionToken<AiMode>('AI_MODE', {
  providedIn: 'root',
  factory: AiModes.built,
});
