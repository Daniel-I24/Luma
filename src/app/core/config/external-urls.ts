/**
 * Every third-party address the app opens or loads, as named constants in
 * one place (scripts/check-hardcoded-urls.mjs refuses http(s) URLs anywhere
 * else in src/). Environment-specific values live in src/environments.
 */
export class ExternalUrls {
  /** Vector map style shared by every map (OpenFreeMap). */
  public static readonly MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
  /** Colombian business registry, opened by the review team. */
  public static readonly RUES = 'https://www.rues.org.co/';
  /** Wompi's hosted checkout: the only payment page the app ever opens. */
  public static readonly WOMPI_CHECKOUT = 'https://checkout.wompi.co/p/';
  /** Credit link LocationIQ's free plan requires next to search results. */
  public static readonly LOCATIONIQ = 'https://locationiq.com';
  /** SVG namespace for markers built with createElementNS. */
  public static readonly SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

  /** Google Maps directions to a "lat,lng" or address. */
  public static directions(destination: string): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  }

  /** WhatsApp chat with a number in E.164 without the plus sign. */
  public static whatsapp(digits: string): string {
    return `https://wa.me/${encodeURIComponent(digits)}`;
  }

  /** WhatsApp chat with a number, with a message already typed. */
  public static whatsappMessage(digits: string, text: string): string {
    return `https://wa.me/${encodeURIComponent(digits)}?text=${encodeURIComponent(text)}`;
  }

  /** Instagram profile URL of a handle. */
  public static instagram(handle: string): string {
    return `https://instagram.com/${encodeURIComponent(handle)}`;
  }

  /** Facebook page URL of a page name. */
  public static facebook(page: string): string {
    return `https://facebook.com/${encodeURIComponent(page)}`;
  }
}
