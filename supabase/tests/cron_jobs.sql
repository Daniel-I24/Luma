-- -----------------------------------------------------------------------------
-- private.reconcile_work_pending (migration 64): it wakes for open attempts and for
-- card refunds to void, not for anything else, and no client role reaches it.
-- Roles: anon, authenticated, postgres. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql

select tests.expect_error('anon', null, $$select private.reconcile_work_pending()$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('cus'), $$select private.reconcile_work_pending()$$, 'permission denied');

delete from public.payments;
select tests.expect_true('postgres', null, $$select not private.reconcile_work_pending()$$, 'nothing to do: the cron stays quiet');

rollback;
