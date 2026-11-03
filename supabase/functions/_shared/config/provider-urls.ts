/**
 * Every third-party URL the Edge Functions call, in one place. Functions
 * import these named constants; no other file in supabase/functions writes
 * an http(s) URL (scripts/check-hardcoded-urls.mjs enforces it).
 */

/** Wompi Colombia (docs.wompi.co, "Ambientes y llaves"; checked 2026-10-24). */
export const WOMPI_API_BASE = {
  test: 'https://sandbox.wompi.co/v1',
  prod: 'https://production.wompi.co/v1',
} as const;
/** Hosted Web Checkout opened by redirection (docs.wompi.co, "Widget & Checkout Web"). */
export const WOMPI_CHECKOUT_URL = 'https://checkout.wompi.co/p/';

/** Firebase Cloud Messaging HTTP v1 and the Google OAuth2 token endpoint. */
export const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const FCM_SEND_URL = (projectId: string): string =>
  `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;

/** Geocoders (docs/geocode.md). */
export const PHOTON_BASE_URL = 'https://photon.komoot.io';
export const MAPTILER_BASE_URL = 'https://api.maptiler.com';
export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
export const LOCATIONIQ_BASE_URL = 'https://us1.locationiq.com/v1';

/** Routing (docs/route.md): OpenRouteService Directions V2; HeiGIT docs checked 2026-10-28. */
export const OPENROUTESERVICE_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions';

/** LLM providers (docs/ai.md); LLM_BASE_URL overrides the OpenAI-compatible one. */
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const OPENAI_COMPATIBLE_DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
export const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
