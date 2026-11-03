import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

/** A screen with a form that may hold changes not saved yet. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Asks before leaving a screen with unsaved changes. The draft stays on the
 * device either way (FormDraftStore), so leaving never loses what was typed.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (screen) => {
  if (!screen?.hasUnsavedChanges?.()) return true;
  const message = inject(TranslocoService).translate('forms.draft.leaveConfirm');
  return globalThis.confirm?.(message) ?? true;
};
