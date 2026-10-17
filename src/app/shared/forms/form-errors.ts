/** Translation key of the first error of each top-level field. */
export type FieldErrors = Readonly<Record<string, string>>;

interface Issue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/** Groups validation issues (zod) by field, keeping the first message of each. */
export function fieldErrors(issues: readonly Issue[]): FieldErrors {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? '');
    if (field && !(field in errors)) errors[field] = issue.message;
  }
  return errors;
}

/**
 * Moves the focus to the first field with an error, following the form
 * order given as [field, element id] pairs. Returns the focused id.
 */
export function focusFirstError(
  document: Document,
  order: readonly (readonly [field: string, elementId: string])[],
  errors: FieldErrors,
): string | null {
  const first = order.find(([field]) => field in errors);
  if (!first) return null;
  document.getElementById(first[1])?.focus();
  return first[1];
}

/** The same errors without the given fields (e.g. once the user edits them). */
export function withoutErrors(errors: FieldErrors, ...fields: string[]): FieldErrors {
  if (!fields.some((field) => field in errors)) return errors;
  return Object.fromEntries(Object.entries(errors).filter(([field]) => !fields.includes(field)));
}
