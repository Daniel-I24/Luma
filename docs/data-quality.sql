-- -----------------------------------------------------------------------------
-- Data quality before validating the round 7 constraints (READ ONLY).
-- Run in the Supabase SQL editor AFTER applying 20261104000000_round7.sql:
-- each query lists the current rows that break one new rule, with the value
-- and what it would become once cleaned (private.clean_text) when that is
-- enough. Fix or clear those rows, run this file again until every query is
-- empty, then run the VALIDATE statements at the end (docs/migrations.md).
-- Nothing here writes.
-- -----------------------------------------------------------------------------

-- profiles_full_name_rule: letters, spaces, ' - . ; 2 to 60; two letters.
select id, full_name, private.clean_text(full_name) as cleaned
from public.profiles
where full_name is not null and not private.is_person_name(full_name);

-- profiles_display_name_rule: clean, 2 to 40, a letter.
select id, display_name, private.clean_text(display_name) as cleaned
from public.profiles
where display_name is not null and not private.is_text_line(display_name, 2, 40);

-- profiles_neighborhood_rule: clean, 1 to 60, a letter or digit.
select id, residence_neighborhood
from public.profiles
where residence_neighborhood is not null and not private.is_text_line(residence_neighborhood, 1, 60, true);

-- businesses_name_rule: letters, digits, spaces and & ' - . , ( ); 2 to 60; a letter.
select id, owner_id, name, private.clean_text(name) as cleaned
from public.businesses
where not private.is_business_name(name);

-- businesses_address_rule: clean, 5 to 120, letters and a number.
select id, owner_id, address
from public.businesses
where not private.is_address(address);

-- businesses_phone_rule: +57 mobile or landline. "suggested" is the +57 form when the number is valid.
select id, owner_id, phone, private.co_phone(phone) as suggested
from public.businesses
where phone is not null and not private.is_co_phone(phone);

-- businesses_website_rule: https, public domain, no user, no IP.
select id, owner_id, website
from public.businesses
where website is not null and not private.is_public_website(website);

-- businesses_description_rule: clean free text, at most 300.
select id, owner_id, left(description, 80) as description_start, private.clean_text(description, true) = '' as only_blanks
from public.businesses
where description is not null and not private.is_clean_text(description, 1, 300, true);

-- menu_items_name_rule / menu_items_section_rule / menu_items_description_rule.
select id, business_id, name, section, left(description, 80) as description_start
from public.menu_items
where not private.is_text_line(name, 1, 80, true)
   or (section is not null and not private.is_text_line(section, 1, 40, true))
   or (description is not null and not private.is_clean_text(description, 1, 300, true));

-- menu_items_price_range: whole pesos between 100 and 10 000 000.
select id, business_id, name, price_cop
from public.menu_items
where price_cop not between 100 and 10000000;

-- promotions_title_rule / promotions_description_rule / promotions_period_length.
select id, business_id, title, starts_at, ends_at
from public.promotions
where not private.is_text_line(title, 3, 80)
   or (description is not null and not private.is_clean_text(description, 1, 300, true))
   or ends_at > starts_at + interval '366 days';

-- reviews_comment_rule (500) and reports_comment_rule (300).
select 'review' as kind, id, left(comment, 80) as comment_start from public.reviews
where comment is not null and not private.is_clean_text(comment, 1, 500, true)
union all
select 'report', id, left(comment, 80) from public.reports
where comment is not null and not private.is_clean_text(comment, 1, 300, true);

-- orders_notes_rule: clean free text, at most 200 (new orders are cleaned by the server).
select id, business_id, left(notes, 80) as notes_start
from public.orders
where notes is not null and not private.is_clean_text(notes, 1, 200, true);

-- business_legal_name_rule (150) / business_legal_rep_rule (person name, 120).
select business_id, legal_name, legal_rep_name
from public.business_legal
where not private.is_business_name(legal_name, 150) or not private.is_person_name(legal_rep_name, 120);

-- business_photos_caption_rule: clean, 1 to 60, a letter or digit.
select id, business_id, caption
from public.business_photos
where caption is not null and not private.is_text_line(caption, 1, 60, true);

-- Owners above the limit of businesses (they keep them; they cannot add more).
select owner_id, count(*) as businesses
from public.businesses
group by owner_id
having count(*) > coalesce((select int_value from public.app_settings where key = 'max_businesses_per_owner'), 3);

-- Once every query above is empty (copy, run one by one):
-- alter table public.profiles validate constraint profiles_full_name_rule;
-- alter table public.profiles validate constraint profiles_display_name_rule;
-- alter table public.profiles validate constraint profiles_neighborhood_rule;
-- alter table public.businesses validate constraint businesses_name_rule;
-- alter table public.businesses validate constraint businesses_address_rule;
-- alter table public.businesses validate constraint businesses_phone_rule;
-- alter table public.businesses validate constraint businesses_website_rule;
-- alter table public.businesses validate constraint businesses_description_rule;
-- alter table public.menu_items validate constraint menu_items_name_rule;
-- alter table public.menu_items validate constraint menu_items_price_range;
-- alter table public.menu_items validate constraint menu_items_description_rule;
-- alter table public.menu_items validate constraint menu_items_section_rule;
-- alter table public.promotions validate constraint promotions_title_rule;
-- alter table public.promotions validate constraint promotions_description_rule;
-- alter table public.promotions validate constraint promotions_period_length;
-- alter table public.reviews validate constraint reviews_comment_rule;
-- alter table public.reports validate constraint reports_comment_rule;
-- alter table public.orders validate constraint orders_notes_rule;
-- alter table public.business_legal validate constraint business_legal_name_rule;
-- alter table public.business_legal validate constraint business_legal_rep_rule;
-- alter table public.business_photos validate constraint business_photos_caption_rule;
