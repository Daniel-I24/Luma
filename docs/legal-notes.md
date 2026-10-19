# Legal notes — to review before launch

Luma is not legal advice and these drafts are not final. A person (ideally
a Colombian lawyer familiar with data protection and consumer law) must
review the following before real users sign up.

## Texts in the app

- `/legal/terms` and `/legal/privacy` (es and en, `public/i18n/*.json` →
  `legal.*`) carry a visible "Borrador sujeto a revisión legal" notice. Fill
  in the placeholders: **controller** (company name, NIT, address), the
  **contact email** for data requests, and the **liability** clause.
- Raise `TERMS_VERSION` (`src/app/shared/legal/legal-version.ts`) whenever
  the texts change; profiles record the version accepted at sign-up.
- Remove the draft notice (`legal.draftNotice`) only after the review.

## Ley 1581 de 2012 and Decreto 1377 de 2013 (habeas data)

- **Consent**: the sign-up asks for terms, privacy authorisation and legal
  age as three checkboxes; the database records one `consented_at` and the
  terms version (`handle_new_user`). Confirm this evidence is enough, or
  whether separate records per authorisation are required.
- **Purposes and necessity**: customers give no address (pick-up only) and
  their phone is optional; owners must give a phone. Confirm the purposes
  listed in the privacy policy match the real use.
- **Holder rights**: profile editing and account deletion exist in the app;
  define the channel and the procedure for the other requests (access,
  proof of authorisation, complaints) and their response times (10 business
  days for queries, 15 for claims, as drafted).
- **Database registration** (RNBD at the SIC) if the company meets the
  thresholds.
- **International transfer**: Supabase, Vercel and, if enabled, the LLM
  provider process data outside Colombia. Review the transfer basis and the
  providers' terms; free LLM tiers may use requests to train models (prompts
  carry no personal data by design, `docs/ai.md`).
- **Retention**: deleted accounts lose profile, favourites, reviews and
  files; orders stay anonymised for the businesses' records. Confirm the
  retention periods (accounting, tax) and state them in the policy.

## Businesses and verification

- The NIT check only validates the DIAN check digit, not that the NIT exists
  or belongs to the owner; reviewers check RUES manually (`docs/admin.md`).
  Decide what the terms promise about verified businesses.
- Suspension and rejection procedures (notice, reasons, appeal) should match
  what the terms say.
- Verification documents (RUT, facade photos) are personal data of the
  owner: private bucket, admin access with 60-second signed URLs, deleted
  with the account. Define how long they are kept after a decision.

## Consumers and prices

- Prices shown are informative; the server computes the charged price,
  including discounts (`docs/orders.md`). Review the Estatuto del
  Consumidor (Ley 1480 de 2011) duties on price information, promotions
  (validity dates, conditions) and order cancellations.
- Payments are at pick-up today; online payments (Wompi, `docs/payments.md`)
  need their own terms and refund policy.

## Minors and age

- The app is for adults (checkbox at sign-up); there is no age verification.
  Confirm this is acceptable, especially for businesses that sell alcohol.

## App stores

- The Play Store needs a privacy policy URL, the data safety form (location,
  email, phone, purchase history) and an account deletion URL or in-app path.
