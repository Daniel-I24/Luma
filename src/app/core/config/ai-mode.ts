import { InjectionToken } from '@angular/core';

/**
 * How Luma IA runs: "rules" (in the app, no external service) or "remote"
 * (Edge Functions recommend and suggest-promotions with the LLM gateway,
 * falling back to the rules on any failure). Rules by default: switch to
 * "remote" here only after deploying the functions and their secrets
 * (docs/ai.md).
 */
export type AiMode = 'rules' | 'remote';

export const AI_MODE = new InjectionToken<AiMode>('AI_MODE', {
  providedIn: 'root',
  factory: () => 'rules',
});
