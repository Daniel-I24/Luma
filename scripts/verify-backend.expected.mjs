/**
 * What scripts/verify-backend.mjs expects of a deployed project: the
 * migrations up to 20261031000000_phone_verification.sql (migration 50,
 * required) and the Edge Functions of this repository. RPCs list their
 * REQUIRED parameters with their SQL types, so each one is called with valid
 * placeholder values (scripts/verify-backend.test.mjs checks them against the
 * migrations).
 */
export const EXPECTED = {
  columns: {
    profiles: ['account_type', 'terms_accepted_at', 'privacy_accepted_at', 'notify_orders', 'notify_promotions',
      'residence_dane_code', 'show_avatar_to_business', 'phone'],
    businesses: ['verification_status', 'prep_minutes', 'whatsapp', 'instagram', 'website', 'orders_paused_until',
      'city_dane_code'],
    menu_items: ['section'],
    promotions: ['discount_percent', 'notified_at'],
    orders: ['status', 'pickup_at', 'payment_status', 'cancel_reason'],
    notifications: ['type', 'promotion_id', 'pushed_at'],
    business_photos: ['storage_path', 'caption'],
    device_tokens: ['token'],
    reports: ['reason'],
    ai_usage: ['scope'],
  },
  rpcs: {
    is_email_confirmed: {},
    create_order: { p_business_id: 'uuid', p_items: 'jsonb' },
    cancel_order: { p_order_id: 'uuid' },
    set_order_status: { p_order_id: 'uuid', p_status: 'text' },
    become_business_owner: {},
    submit_business_for_review: { p_business_id: 'uuid' },
    review_business: { p_business_id: 'uuid', p_decision: 'text', p_note: 'text', p_seen_updated_at: 'timestamptz' },
    consume_ai_quota: {},
    consume_menu_scan_quota: { p_business_id: 'uuid' },
    consume_geocode_quota: {},
    register_device_token: { p_token: 'text', p_platform: 'text' },
    unregister_device_token: { p_token: 'text' },
    notify_promotion: { p_promotion_id: 'uuid' },
    export_my_data: {},
    expire_stale_orders: {},
    claim_push_batch: {},
    admin_access: {},
    is_profile_complete: {},
    set_avatar: { p_path: 'text', p_consent: 'boolean' },
    my_trust_status: {},
    payment_config: {},
    prepare_payment: { p_order_id: 'uuid', p_environment: 'text' },
    my_order_payment: { p_order_id: 'uuid' },
    record_payment_redirect: { p_order_id: 'uuid', p_transaction_id: 'text' },
    set_orders_paused: { p_business_id: 'uuid', p_minutes: 'integer' },
    owner_sales_daily: { p_business_id: 'uuid', p_days: 'integer' },
    business_review_flags: { p_business_id: 'uuid' },
    admin_payment_issues: {},
    hit_rate_limit: { p_bucket: 'text' },
    is_phone_verified: {},
    phone_check_passed: {},
    // Migration 50 (phone verification): required.
    verified_auth_phone: {},
    sync_verified_phone: {},
    // Migration 52 (round 5): reported apart while it is not applied.
    request_contact_verification: { p_business_id: 'uuid', p_kind: 'text' },
    admin_pending_contact_verifications: {},
    admin_verify_contact: { p_verification_id: 'uuid', p_decision: 'text' },
    business_trust_summary: { p_business_id: 'uuid' },
    request_legal_correction: { p_business_id: 'uuid' },
    send_test_notification: {},
    // Migration 53 (round 6): reported apart while it is not applied.
    contact_verifier_config: {},
    start_website_check: { p_business_id: 'uuid' },
    verify_contact_from_whatsapp: { p_message_id: 'text', p_sender_hash: 'text', p_sender: 'text', p_code: 'text' },
    complete_website_check: { p_verification_id: 'uuid' },
  },
  /** RPCs that come from migration 50; reported as such. */
  migration50: ['verified_auth_phone', 'sync_verified_phone'],
  /** RPCs of migrations in review: "missing" is expected until each is applied (not a failure). */
  pending: {
    52: ['request_contact_verification', 'admin_pending_contact_verifications', 'admin_verify_contact',
      'business_trust_summary', 'request_legal_correction', 'send_test_notification'],
    53: ['contact_verifier_config', 'start_website_check', 'verify_contact_from_whatsapp', 'complete_website_check'],
  },
  functions: ['delete-account', 'recommend', 'suggest-promotions', 'extract-menu', 'geocode', 'push-dispatch',
    'create-payment', 'wompi-webhook', 'reconcile-payments', 'void-payment', 'route', 'verify-website',
    'whatsapp-webhook'],
  buckets: { 'business-images': 'public', 'verification-docs': 'private', avatars: 'private' },
};

/** Valid placeholder values per SQL type: the null uuid, filler text and numbers. */
export const PLACEHOLDERS = {
  uuid: '00000000-0000-0000-0000-000000000000',
  text: 'verify-backend',
  integer: 1,
  boolean: false,
  jsonb: [],
  timestamptz: '1970-01-01T00:00:00Z',
};

/** The JSON body of an RPC call with placeholder values for its required parameters. */
export function rpcBody(params) {
  return Object.fromEntries(Object.entries(params).map(([name, type]) => [name, PLACEHOLDERS[type]]));
}
