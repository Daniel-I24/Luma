# Business verification

Why: nobody should be able to publish a fake restaurant, a wrong address or
someone else's business. A business is public only when it is **published
by its owner and approved by the review team**.

## States

| `verification_status` | Who sets it | Public? | Owner may edit legal data / documents |
| --- | --- | --- | --- |
| `draft` | new business | no | yes |
| `pending` | owner, `submit_business_for_review` | no | no |
| `approved` | admin, `review_business` | when `is_active` | no |
| `rejected` (changes requested) | admin, note required | no | yes |
| `suspended` | admin (only from approved), note required | no | no |

Transitions: draft or rejected → pending (only when nothing is missing);
pending → approved or rejected; approved → suspended. A verified business
whose owner changes **name, address or location** goes back to `pending`
(trigger); Luma Negocios warns before saving such a change.

Visibility is decided in one place, `is_business_public(uuid)`
(`is_active and verification_status = 'approved'`), used by every public
policy and view, Storage reads and `create_order`.

## What the review needs

`submit_business_for_review` returns `{ ok, missing[] }` and only moves the
business to `pending` when `missing` is empty. Codes, in display order:
`name`, `category`, `address`, `location`, `phone`, `open_day`,
`available_item`, `legal`, `doc_rut`, `doc_facade`. The Summary of Luma
Negocios shows the same list (`missingForReview`), each item linked to the
screen that fixes it; the server stays the authority.

- **Legal data** (`business_legal`, private: owner and admins): NIT with its
  DIAN check digit (`Nit` value object and a CHECK; this validates the
  format, not that the NIT exists or belongs to the owner), legal name and
  legal representative.
- **Documents** (`business_verification_docs` + private bucket
  `verification-docs`, 5 MB, JPEG/PNG/WebP/PDF): RUT and a facade photo
  required, others optional. Paths `{business}/{kind}/{uuid}.{ext}`;
  admins open them with 60-second signed URLs. They are deleted with the
  account (delete-account).

## The review (admins)

See [admin.md](admin.md). The reviewer checks the NIT and legal name on
[RUES](https://www.rues.org.co/), compares the RUT with the legal data, the
facade photo with the map location, and the menu with the category. A
rejection or suspension needs a note: the owner sees it on the Summary
together with "Corregir" and "Reenviar a revisión".

## Reports

Any signed-in user can report a public business (`reports`: false
information, does not exist, inappropriate, other; optional comment). Admins
see open reports without the reporter's identity.
