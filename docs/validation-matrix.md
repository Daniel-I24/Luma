# Validation matrix (round 7)

Every field that customers, owners and admins write, with its rule, examples,
the message the app shows (Spanish, `validation.*` and the older `auth.*`
keys) and where it is enforced: the form (core/validation rules, shown under
the field when leaving it and on submit) and the database (private SQL
functions and CHECK constraints of `20261104000000_round7.sql`, NOT VALID until
`docs/data-quality.sql` is clean).

The rules live once, in `src/app/core/validation` (Specification pattern:
`Spec`, `FieldRule`, `TextRules`, `ContactRules`, `NumberRules`, `AuthRules`,
`DateRules`), and the same rules exist in SQL (`private.is_person_name`,
`private.is_business_name`, `private.is_address`, `private.co_phone`,
`private.is_co_phone`, `private.is_instagram_handle`,
`private.is_public_website`, `private.clean_text`, `private.is_clean_text`,
`private.is_text_line`, `public.is_valid_nit`). The shared vectors
`supabase/tests/fixtures/validation_vectors.json` run in
`src/app/core/validation/validation-vectors.spec.ts` and in
`supabase/tests/round7.sql`, so the app and the database cannot disagree.
`npm run check:validation` fails when a form field has no validator and is
not in `scripts/check-validation.exceptions.mjs`.

## Common text rule (every free text)

What is stored: control characters (but line feed in multi-line texts),
zero-width characters, word joiners, BOM, soft hyphen and text-direction
marks removed; runs of spaces made one space; at most one empty line between
paragraphs; trimmed; Unicode NFC. The app cleans while saving (it never
drops keys while typing); the database rejects a value that is not already
clean (`private.is_clean_text`), except order notes, which the server cleans
itself (`orders_clean_notes`).

## Letras Unicode en Postgres

Postgres decides `[[:alpha:]]` with the collation of the expression. Checked
on Postgres 17 (2026-10-31): under the `C` collation `'Ñandú' ~ '^[[:alpha:]]+$'`
is false (only ASCII letters); under `"und-x-icu"` (ICU) and `en_US.utf8` it is
true, also for Greek, Cyrillic and CJK; emojis and digits are never letters.
The rule functions therefore force `collate "und-x-icu"` (present on Supabase
and on the official Postgres images), independent of the database default.
The app uses `\p{L}` (Unicode letters) and `\p{Nd}` (decimal digits), which is
what ICU's `[[:alpha:]]` and `[[:digit:]]` mean. The round7 suite checks both
behaviours.

## Customers

| Field | Rule | Valid | Invalid | Message | Form | Database |
| --- | --- | --- | --- | --- | --- | --- |
| Registro: correo | e-mail, at most 254, lower case | `ana@correo.com` | `ana@`, `ana correo.com` | Ingresa un correo electrónico válido. | credentials step, `emailSchema` | Supabase Auth (no own column) |
| Registro: contraseña | 8 to 72, a letter and a digit, not a common one | `Pasto2026` | `12345678`, `password1` | Usa al menos 8 caracteres, con letras y números. | credentials step | Supabase Auth |
| Registro / Mis datos: nombre | person name: letters, spaces, `'` `’` `-` `.`; starts with a letter; 2 to 60; at least 2 letters; no digits or emojis | `María José`, `O'Connor`, `Ana-Lucía` | `Ana3`, `R2D2`, `Ana 😀`, `A` | Escribe el nombre solo con letras (de 2 a 60)… | personal step, `AccountDetailsStore` | `profiles_full_name_rule`; `handle_new_user` drops an invalid sign-up name |
| Registro / Mis datos: celular | Colombian mobile `3XXXXXXXXX`, stored `+573XXXXXXXXX` | `300 123 4567` | `601 234 5678`, `12345` | Escribe un celular colombiano de 10 dígitos que empiece por 3… | personal step, `AccountDetailsStore` | `profiles_phone_co_mobile` |
| Residencia: departamento y municipio | one of the DANE catalog | Nariño / Pasto | — | Elige tu departamento y municipio. | residence picker | `profiles_residence_*` |
| Residencia: barrio (optional) | clean line, 1 to 60, a letter or digit | `Las Cuadras` | `---`, 61 characters | Revisa este texto: es muy largo o no tiene letras ni números. | residence picker | `profiles_neighborhood_rule` |
| Nombre público | clean line, 2 to 40, a letter | `Cami` | `1`, `!!` | Usa de 2 a 40 caracteres, con al menos una letra. | display-name field | `profiles_display_name_rule` |
| Notas del pedido (optional) | free text, at most 200 | `Sin cebolla, por favor` | 201 characters | (counter; maxlength) | checkout | `orders_notes_rule` + server cleaning |
| Hora de recogida | one of the offered slots | 12:30 | — | (fixed list) | checkout | `create_order` (hours) |
| Reseña: estrellas | 1 to 5 | 4 | 0 | — | review form | `reviews_rating_check` |
| Reseña: comentario (optional) | free text, at most 500 | `Muy rico` | 501 characters | El texto es demasiado largo. | review form | `reviews_comment_rule` |
| Reporte: motivo | one of four | `false_info` | — | (fixed list) | report sheet | `reports_reason_valid` |
| Reporte: comentario (optional) | free text, at most 300 | `Ya cerró` | 301 characters | El texto es demasiado largo. | report sheet | `reports_comment_rule` |
| Búsquedas (mapa, dirección, municipio, IA) | one line, at most 80, cleaned; never stored | `pizza` | — | (maxlength) | search inputs (exceptions list) | not stored |
| Recuperar / verificar correo | e-mail | as above | as above | Escribe un correo válido… | forgot-password, verify-code | Supabase Auth |
| Códigos (correo, SMS, eliminar cuenta) | 6 digits; the field keeps only digits | `123456` | `12a456`, `1234` | Escribe los 6 dígitos del código. | `AuthRules.code` | Supabase Auth |
| Cambiar contraseña | current required; new as in sign-up | — | — | Escribe tu contraseña. / Usa al menos 8 caracteres… | account-password | Supabase Auth |
| Mensajes de soporte | no field in the app: support is WhatsApp and e-mail outside Luma | — | — | — | — | — |

## Owners

| Field | Rule | Valid | Invalid | Message | Form | Database |
| --- | --- | --- | --- | --- | --- | --- |
| Nombre del negocio | letters, digits, spaces and `& ' ’ - . , ( )`; 2 to 60; a letter; no emojis, control or direction characters | `D&D Pizzería`, `Panadería 24 Horas` | `123`, `Bar #1`, `😀 Café` | Usa de 2 a 60 caracteres: letras, números, espacios y & ' - . , ( )… | business basics | `businesses_name_rule` |
| Categoría | one of the list | Cafetería | — | (fixed list) | business basics | `businesses_category_valid` |
| Teléfono del negocio (optional) | mobile `3XXXXXXXXX` or landline `60` + area 1-8 + 7 digits, stored `+57…` | `300 123 4567`, `(601) 234 5678` | `5012345678`, `601 234 567` | Escribe un celular (300 123 4567) o un fijo con indicativo (601 234 5678). | business basics | `businesses_phone_rule` |
| Dirección | clean, 5 to 120, letters and a number, `# . , / ° º ( ) ' -` | `Calle 18 # 25-30` | `Calle sin número`, `12345` | Escribe la dirección con la calle y el número… | business basics | `businesses_address_rule` |
| Municipio y ubicación | DANE code; latitude/longitude in range | 52001 | — | Elige el municipio. / Marca la ubicación. | business basics | `businesses_city_dane_code_shape`, `businesses_location_range` |
| Descripción (optional) | free text, at most 300 | `Arepas desde 1990` | 301 characters | El texto es demasiado largo. | business info | `businesses_description_rule` |
| Tiempo de preparación | whole minutes 5 to 180; digits only | `20` | `2`, `300` | (businessPanel.validation.prepMinutes) | business info | `businesses_prep_minutes_range` |
| WhatsApp (optional) | Colombian mobile, `+573…` | `300 444 5566` | `601 234 5678` | Escribe un celular colombiano de 10 dígitos… | contact page | `businesses_whatsapp_co_mobile` |
| Instagram (optional) | letters, digits, `.` `_`, up to 30, lower case; `@` and the profile URL are removed | `cafe.publico` | `cafe-publico`, 31 characters | Escribe tu usuario de Instagram… | contact page | `businesses_instagram_handle` |
| Facebook (optional) | page name `A-Za-z0-9.-`, 2 to 80; the URL is removed | `CafePublico` | `c` | Escribe el nombre de tu página de Facebook… | contact page | `businesses_facebook_page` |
| Sitio web (optional) | must start with `https://`; public domain in lower case; port 443 only; no user, no IP, no `.local`/`.internal`… ; up to 200 | `https://cafe.co/menu` | `cafe.co`, `http://cafe.co`, `https://user@cafe.co`, `https://192.168.1.10` | La dirección debe empezar por https://… Sin https:// no se puede verificar. | contact page | `businesses_website_rule` |
| Horarios | `HH:MM`; opens ≠ closes (closing earlier crosses midnight) | 08:00–20:00 | 08:00–08:00 | (businessPanel.validation.sameTimes) | business hours | `business_hours_open_differs` |
| Producto: nombre | clean, 1 to 80, a letter or digit | `Tinto`, `Combo 2` | `---` | Escribe el nombre del producto, hasta 80 caracteres. | menu form, menu row, menu scan | `menu_items_name_rule` |
| Producto: precio | whole pesos 100 to 10 000 000; digits only | `12500` | `50`, `10000001` | Escribe un precio entre $100 y $10.000.000, sin decimales. | menu form, menu row, menu scan | `menu_items_price_range` |
| Producto: sección (optional) | clean, 1 to 40, a letter or digit | `Bebidas` | 41 characters | Revisa este texto… | menu form, menu scan | `menu_items_section_rule` |
| Producto: descripción (optional) | free text, at most 300 | `Con queso` | 301 characters | El texto es demasiado largo. | menu form | `menu_items_description_rule` |
| Promoción: título | clean, 3 to 80, a letter | `Tinto al 2x1` | `2x1`, `!!!` | Escribe un título de 3 a 80 caracteres… | promotion form | `promotions_title_rule` |
| Promoción: descripción (optional) | free text, at most 300 | `Solo los lunes` | 301 characters | El texto es demasiado largo. | promotion form | `promotions_description_rule` |
| Promoción: fechas | valid; end after start; at most 366 days; a new one not already over | hoy → +7 días | fin antes del inicio, 400 días | La fecha de fin debe ser posterior… / Una promoción puede durar hasta un año. / La fecha de fin ya pasó. | promotion form (`DateRules.period`) | `promotions_dates_order`, `promotions_period_length` |
| Promoción: descuento (optional) | whole 1 to 90 %, needs a product | `10` | `0`, `91` | El descuento va de 1 % a 90 %. | discount fields | `promotions_discount_percent_range`, `promotions_discount_needs_item` |
| Galería: pie de foto (optional) | clean, 1 to 60, a letter or digit | `Fachada` | 61 characters | Revisa este texto… | gallery | `business_photos_caption_rule` |
| Datos legales: NIT | DIAN check digit (weights 3, 7, 13… mod 11); stored `800197268-4` | `800.197.268-4` | `800197268-5` | Revisa el NIT y su dígito de verificación… | legal form | `business_legal_tax_id_valid` (`public.is_valid_nit`) |
| Datos legales: razón social | business-name characters, 2 to 150 | `Fritanga S.A.S.` | `#1` | Escribe la razón social como aparece en el RUT… | legal form | `business_legal_name_rule` |
| Datos legales: representante | person name, 2 to 120 | `Ana Pérez` | `Ana 3` | Escribe el nombre del representante solo con letras… | legal form | `business_legal_rep_rule` |
| Documentos | PDF/JPG/PNG/WebP, size limit | `rut.pdf` | `.exe` | (verification.docs) | doc list | storage path CHECK, bucket |
| Menú pegado (escaneo) | at most 8000; parsed into products checked one by one | — | — | — | menu scan (exception) | not stored |

## Admins

| Field | Rule | Message | Form | Database |
| --- | --- | --- | --- | --- |
| Nota de la revisión | required to reject, at most 300 | (admin.review.noteRequired) | review decision | `businesses_verification_note_length` |
| Código MFA | 6 digits | Escribe los 6 dígitos del código. | admin MFA | Supabase Auth |
