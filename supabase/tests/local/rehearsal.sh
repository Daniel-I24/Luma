#!/usr/bin/env bash
# Production-like rehearsal of the pending migrations:
#   1. a fresh database with the Supabase stubs and ONLY the four migrations
#      already applied in production;
#   2. legacy data shaped like production, including dirty rows;
#   3. every pending migration, in order (must not fail on that data);
#   4. checks of what existing rows look like afterwards (rehearsal_checks.sql)
#      and the VALIDATE report (supabase/sql/validate-report.sql).
#
#   PSQL=psql PGUSER=postgres supabase/tests/local/rehearsal.sh
set -euo pipefail
cd "$(dirname "$0")/../../.."
PSQL="${PSQL:-psql}"
DB=luma_rehearsal
export PGCLIENTENCODING=UTF8
run() { "$PSQL" -v ON_ERROR_STOP=1 -q "$@"; }
quiet() { PGOPTIONS="--client-min-messages=warning" run "$@"; }
APPLIED='^supabase/migrations/(20240001000000|20240002000000|20261014000000|20261015000000)_'

run -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null
for stub in supabase/tests/local/0*.sql; do quiet -d "$DB" -f "$stub" >/dev/null; done
for migration in supabase/migrations/*.sql; do
  if [[ "$migration" =~ $APPLIED ]]; then quiet -d "$DB" -f "$migration" >/dev/null; fi
done
echo "applied migrations: ok"
quiet -d "$DB" -f supabase/tests/local/legacy_seed.sql >/dev/null
echo "legacy data: ok"
for migration in supabase/migrations/*.sql; do
  if [[ ! "$migration" =~ $APPLIED ]]; then
    quiet -d "$DB" -f "$migration" >/dev/null || { echo "FAIL $migration"; exit 1; }
  fi
done
echo "pending migrations on legacy data: ok"
output=$(run -d "$DB" -f supabase/tests/local/rehearsal_checks.sql 2>&1) || { echo "$output" | grep -E 'ERROR|FAIL' | head -5; exit 1; }
echo "checks: $(echo "$output" | grep -c 'NOTICE:  ok') ok"
echo "VALIDATE report (rows to fix before validating):"
run -d "$DB" -f supabase/sql/validate-report.sql | grep -vE '^\s*$|^CREATE'
