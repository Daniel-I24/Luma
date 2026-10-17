#!/usr/bin/env bash
# Runs every SQL security suite on a throwaway local Postgres database:
# Supabase stubs (roles, auth.uid(), storage), all migrations in order, then
# each supabase/tests/*.sql file (each one rolls back).
#
#   PSQL=psql PGPORT=5432 PGUSER=postgres supabase/tests/local/run.sh [test files]
#
# Needs a superuser connection. The database luma_test is dropped and created.
set -euo pipefail
cd "$(dirname "$0")/../../.."
PSQL="${PSQL:-psql}"
DB=luma_test
# The SQL files are UTF-8 (category names such as Cafetería).
export PGCLIENTENCODING=UTF8
run() { "$PSQL" -v ON_ERROR_STOP=1 -q "$@"; }

run -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null
quiet() { PGOPTIONS="--client-min-messages=warning" run "$@"; }
for stub in supabase/tests/local/0*.sql; do quiet -d "$DB" -f "$stub" >/dev/null; done
for migration in supabase/migrations/*.sql; do quiet -d "$DB" -f "$migration" >/dev/null; done
echo "migrations: ok"

[ $# -gt 0 ] || set -- supabase/tests/[a-z]*.sql
total=0
for test in "$@"; do
  output=$(run -d "$DB" -f "$test" 2>&1) || { echo "FAIL $test"; echo "$output" | grep -E 'ERROR|FAIL' | head -5; exit 1; }
  checks=$(echo "$output" | grep -c 'NOTICE:  ok' || true)
  total=$((total + checks))
  echo "pass $test: $checks checks"
done
echo "total: $total checks"
