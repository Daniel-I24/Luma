/** Errors of the business panel writes, as translation keys. */
const MESSAGE_KEYS: Readonly<Record<string, string>> = {
  publish_requirements_missing: 'businessPanel.errors.publishRequirements',
  not_business_owner: 'businessPanel.errors.notBusinessOwner',
  business_limit_reached: 'businessPanel.errors.businessLimit',
};
const CODE_KEYS: Readonly<Record<string, string>> = {
  '23514': 'businessPanel.errors.invalidData',
  '23505': 'businessPanel.errors.duplicate',
  '42501': 'businessPanel.errors.forbidden',
};

/** Maps a PostgREST error to a translation key; never exposes its text. */
export function mapWriteError(
  error: { code?: string; message?: string } | null | undefined,
  fallback: string,
): string {
  if (!error) return fallback;
  return MESSAGE_KEYS[error.message?.trim() ?? ''] ?? CODE_KEYS[error.code ?? ''] ?? fallback;
}
