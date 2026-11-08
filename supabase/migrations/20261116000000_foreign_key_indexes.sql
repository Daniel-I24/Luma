-- -----------------------------------------------------------------------------
-- Migration: foreign_key_indexes (pending review).
-- Seven foreign keys had no index (production, read-only check of 2026-11-07).
-- Deleting the parent row (a business, an order, a promotion, a menu item or a
-- user) made Postgres read the whole child table to apply ON DELETE. The
-- nullable columns get partial indexes: rows without the reference never need
-- them. supabase/tests/foreign_key_indexes.sql keeps every public foreign key
-- indexed from now on.
-- -----------------------------------------------------------------------------

create index if not exists notifications_business_id_idx
  on public.notifications (business_id) where business_id is not null;
create index if not exists notifications_order_id_idx
  on public.notifications (order_id) where order_id is not null;
create index if not exists notifications_promotion_id_idx
  on public.notifications (promotion_id) where promotion_id is not null;
create index if not exists order_items_menu_item_id_idx
  on public.order_items (menu_item_id) where menu_item_id is not null;
create index if not exists order_items_promotion_id_idx
  on public.order_items (promotion_id) where promotion_id is not null;
create index if not exists rate_limit_hits_user_id_idx on public.rate_limit_hits (user_id);
create index if not exists reports_business_id_idx on public.reports (business_id);

notify pgrst, 'reload schema';
