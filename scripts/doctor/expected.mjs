/**
 * What `npm run doctor` expects of the deployed project: the functions of
 * supabase/config.toml, the secret NAMES of each feature (never values) and
 * the app_settings flags it reports.
 */
export const FUNCTIONS = [
  'delete-account', 'recommend', 'suggest-promotions', 'extract-menu', 'geocode', 'route', 'verify-website',
  'whatsapp-webhook', 'push-dispatch', 'create-payment', 'wompi-webhook', 'reconcile-payments', 'void-payment',
];

/** Per feature: required secret names, optional ones, and the functions it needs. */
export const FEATURES = {
  ia: {
    label: 'Luma IA',
    secrets: ['LLM_PROVIDER', 'LLM_MODEL', 'LLM_API_KEY'],
    optional: ['LLM_FALLBACK_MODEL', 'LLM_VISION_MODEL'],
    functions: ['recommend', 'suggest-promotions', 'extract-menu'],
    option: 1,
  },
  push: {
    label: 'Notificaciones push',
    secrets: ['FCM_SERVICE_ACCOUNT', 'PUSH_DISPATCH_SECRET'],
    optional: [],
    functions: ['push-dispatch'],
    option: 2,
  },
  pagos: {
    label: 'Pagos con Wompi',
    secrets: ['WOMPI_ENV', 'WOMPI_PUBLIC_KEY', 'WOMPI_PRIVATE_KEY', 'WOMPI_INTEGRITY_SECRET', 'WOMPI_EVENTS_SECRET', 'PAYMENTS_CRON_SECRET', 'PAYMENT_RETURN_URL'],
    optional: [],
    functions: ['create-payment', 'wompi-webhook', 'reconcile-payments', 'void-payment'],
    option: 3,
  },
  rutas: {
    label: 'Rutas (Cómo llegar)',
    secrets: ['ROUTE_API_KEY'],
    optional: ['ROUTE_PROVIDER'],
    functions: ['route'],
    option: 4,
  },
  whatsapp: {
    label: 'WhatsApp (verificación de contactos)',
    secrets: ['WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_PHONE_NUMBER_ID'],
    optional: [],
    functions: ['whatsapp-webhook'],
    option: 5,
  },
};

/** Flags shown as they are (they are not secrets). */
export const FLAGS = [
  'payments_enabled', 'payments_production', 'show_pending_businesses', 'require_phone_verification',
  'max_businesses_per_owner', 'rate_business_create_max',
];
