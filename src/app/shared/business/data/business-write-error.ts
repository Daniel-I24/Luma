/** Errors of the business panel writes, as translation keys. */
const MESSAGE_KEYS: Readonly<Record<string, string>> = {
  publish_requirements_missing: 'businessPanel.errors.publishRequirements',
  not_business_owner: 'businessPanel.errors.notBusinessOwner',
  business_limit_reached: 'businessPanel.errors.businessLimit',
  promotion_limit: 'businessPanel.errors.promotionLimit',
  promotion_item_mismatch: 'businessPanel.errors.promotionItemMismatch',
  business_under_review: 'businessPanel.errors.underReview',
  email_not_confirmed: 'errors.emailNotConfirmed',
  gallery_limit: 'businessPanel.errors.galleryLimit',
  menu_limit: 'businessPanel.errors.menuLimit',
  already_notified: 'businessPanel.notify.already',
  notify_limit: 'businessPanel.notify.limit',
  promotion_not_running: 'businessPanel.notify.notRunning',
  business_not_public: 'businessPanel.notify.notPublic',
};
const CODE_KEYS: Readonly<Record<string, string>> = {
  '23514': 'businessPanel.errors.invalidData',
  '23505': 'businessPanel.errors.duplicate',
  '42501': 'businessPanel.errors.forbidden',
};

/** BusinessWriteErrors — maps business write errors to translation keys. */
export class BusinessWriteErrors {
  /** Maps a PostgREST error to a translation key; never exposes its text. */
  public static mapWriteError(
    error: { code?: string; message?: string } | null | undefined,
    fallback: string,
  ): string {
    if (!error) return fallback;
    return MESSAGE_KEYS[error.message?.trim() ?? ''] ?? CODE_KEYS[error.code ?? ''] ?? fallback;
  }
}

