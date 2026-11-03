/**
 * Form fields of the templates that need no validator of their own, each with
 * its reason (scripts/check-validation.mjs). Keyed by file and the field id
 * (or its bound id expression). Keep the reason honest: a new free-text
 * field belongs in core/validation, not here.
 */
export const EXCEPTIONS = [
  // Searches: one line, at most 80 characters (maxlength), cleaned before searching, never stored.
  { file: 'src/app/design-system/search-input/luma-search-input.html', field: 'inputId()', why: 'search box: maxlength 80, never stored' },
  { file: 'src/app/features/owner/components/address-search/address-search.html', field: "idPrefix() + '-address-search'", why: 'address search: maxlength 80, cleaned (TextRules.search), never stored' },
  { file: 'src/app/shared/geo/residence-picker/residence-picker.html', field: 'residence-city', why: 'municipality search over the DANE catalog: only a listed option is stored' },
  // Choices from a fixed list: the value is always one of the options.
  { file: 'src/app/features/checkout/checkout.page.html', field: 'checkout-time', why: 'pick-up time from the computed slots; create_order checks it again' },
  { file: 'src/app/features/owner/owner-shell/owner-shell.html', field: 'owner-business-switch', why: "switches between the owner's own businesses" },
  { file: 'src/app/features/promotions/components/promotion-filters/promotion-filters.html', field: 'promo-sort', why: 'sort order of a list, never stored' },
  { file: 'src/app/features/promotions/components/promotion-filters/promotion-filters.html', field: 'promo-min', why: 'filter of a list, never stored' },
  { file: 'src/app/shared/geo/residence-picker/residence-picker.html', field: 'residence-department', why: 'department from the DANE catalog' },
  // Validated together with another field, whose error shows for both.
  { file: 'src/app/features/owner/pages/business-hours/business-hours.page.html', field: "'hours-' + day.day_of_week + '-opens'", why: 'native time input; the day (opens and closes) is checked by dayHoursSchema and its error shows under "Cierra"' },
  // Text to read, not to store: every product it yields is checked in the review list.
  { file: 'src/app/features/owner/pages/menu-scan/menu-scan.page.html', field: 'scan-paste', why: 'pasted menu text (maxlength 8000) is parsed into products that are validated one by one' },
];
