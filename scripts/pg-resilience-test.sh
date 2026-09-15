#!/usr/bin/env bash
#
# Can this file always finish, from whatever state a previous run left behind?
#
# The question is not academic. A real run of this file died two thirds of the
# way through on a live project — pgcrypto was in `extensions`, a function's
# own search_path did not name it, and the apply stopped at that statement.
# What was left was a database with the first two thirds applied and the rest
# missing, and the only instruction that helps somebody in that position is
# "run it again".
#
# So that has to be true from ANY stopping point, not just the one that
# happened. This chops the file at a spread of safe statement boundaries,
# applies the prefix, then applies the whole file on top and requires that it
# completes AND lands in exactly the state a clean single run produces.
#
# It also covers the two environment shapes that have each already produced a
# bug: extensions living in `extensions`, and a search_path that does not name
# them.
set -uo pipefail

BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
DATA=${PGDATA_DIR:-/tmp/mintplaza-resilience}
PORT=${PGPORT:-55436}
HERE=$(cd "$(dirname "$0")" && pwd)
SCHEMA="$HERE/../supabase/schema.sql"
WORK=$(mktemp -d)

AS=""
if [ "$(id -u)" = "0" ]; then AS="su -s /bin/sh ${SERVER_USER:-nobody} -c"; fi
run_as() { if [ -n "$AS" ]; then $AS "$*"; else sh -c "$*"; fi; }
cleanup() {
  run_as "$BIN/pg_ctl -D $DATA stop -m immediate" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

rm -rf "$DATA"; mkdir -p "$DATA"
[ -n "$AS" ] && chown -R "${SERVER_USER:-nobody}" "$DATA"
run_as "$BIN/initdb -D $DATA -U postgres -A trust" >/dev/null 2>&1
run_as "$BIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp -c listen_addresses=' -l $DATA/server.log start -w" >/dev/null 2>&1

fresh() {
  psql -h /tmp -p "$PORT" -U postgres -q -c "drop database if exists $1" postgres >/dev/null 2>&1
  psql -h /tmp -p "$PORT" -U postgres -q -c "create database $1" postgres >/dev/null 2>&1
}

# The Supabase layout, since that is the one that has bitten twice: both
# extensions in `extensions`, and nothing in public.
supabase_shape() {
  psql -h /tmp -p "$PORT" -U postgres -q -d "$1" >/dev/null 2>&1 <<'SHAPE'
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
do $$ begin create role anon nologin;          exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin;  exception when duplicate_object then null; end $$;
create schema if not exists auth;
create schema if not exists storage;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(), email text,
  raw_user_meta_data jsonb not null default '{}',
  raw_app_meta_data jsonb not null default '{}',
  created_at timestamptz not null default now());
create or replace function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
create or replace function auth.jwt() returns jsonb language sql stable as $f$ select '{}'::jsonb $f$;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text,
  owner uuid, created_at timestamptz default now(), metadata jsonb);
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $f$ select string_to_array(name, '/') $f$;
SHAPE
}

# A deliberately hostile session: the role's search_path names neither
# `extensions` nor anything helpful. The file has to set its own.
apply() {
  psql -h /tmp -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q \
       -c 'set search_path = pg_catalog' -d "$1" -f "$2" 2>&1
}

fingerprint() {
  psql -h /tmp -p "$PORT" -U postgres -q -t -A -d "$1" -c "
    select md5(string_agg(x, '|' order by x)) from (
      select table_name||':'||column_name||':'||data_type||':'||coalesce(column_default,'') as x
        from information_schema.columns where table_schema in ('public','mintplaza')
      union all
      select 'fn:'||n.nspname||'.'||p.proname||':'||pg_get_function_identity_arguments(p.oid)
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname in ('public','mintplaza')
      union all
      select 'pol:'||c.relname||':'||pol.polname
        from pg_policy pol join pg_class c on c.oid=pol.polrelid
      union all
      select 'con:'||conrelid::regclass::text||':'||conname
        from pg_constraint where connamespace='public'::regnamespace
      union all
      select 'idx:'||indexname from pg_indexes where schemaname='public'
    ) q;"
}

pass=0; fail=0
ok()   { echo "PASS  $1"; pass=$((pass+1)); }
bad()  { echo "FAIL  $1"; fail=$((fail+1)); }

echo "=============================================================="
echo "Recovering from a run that stopped part-way"
echo "=============================================================="

# The reference: one clean run into an empty, Supabase-shaped database.
fresh ref; supabase_shape ref
if ! apply ref "$SCHEMA" >"$WORK/ref.log" 2>&1; then
  echo "FAIL  the file does not apply cleanly at all:"; grep -iE "ERROR" "$WORK/ref.log" | head -3; exit 1
fi
REF=$(fingerprint ref)
ok "a clean run into an empty Supabase-shaped database, with no extensions in the session path"
echo "      reference fingerprint: ${REF:0:16}…"
echo

# Safe cut points: a blank line, outside any $$ body, after a statement ends.
mapfile -t CUTS < <(python3 - "$SCHEMA" <<'PY'
import sys
src = open(sys.argv[1]).read().split('\n')
n = len(src); safe=[]; dollars=0; last=''
for i, line in enumerate(src):
    if line.strip()=='' and dollars%2==0 and last.rstrip().endswith(';'):
        safe.append(i+1)
    dollars += line.count('$$')
    if line.strip(): last=line
# Twelve stopping points spread across the file.
for k in range(1, 13):
    t = n*k//13
    print(min(safe, key=lambda s: abs(s-t)))
PY
)

for cut in "${CUTS[@]}"; do
  db="rec_$cut"
  fresh "$db"; supabase_shape "$db"
  head -n "$cut" "$SCHEMA" > "$WORK/prefix.sql"

  # The partial run. It is allowed to fail; that is the point.
  apply "$db" "$WORK/prefix.sql" >"$WORK/p.log" 2>&1

  # Now the thing a person in that position is told to do: run it again.
  if apply "$db" "$SCHEMA" >"$WORK/full.log" 2>&1; then
    got=$(fingerprint "$db")
    if [ "$got" = "$REF" ]; then
      ok "stopped at line $cut, re-ran, identical to a clean install"
    else
      bad "stopped at line $cut, re-ran clean but the result DIFFERS from a clean install"
    fi
  else
    bad "stopped at line $cut, and re-running does NOT recover:"
    grep -iE "^psql.*ERROR" "$WORK/full.log" | head -3
  fi
done

echo
echo "=============================================================="
echo "Running it more than once"
echo "=============================================================="
fresh twice; supabase_shape twice
apply twice "$SCHEMA" >/dev/null 2>&1
if apply twice "$SCHEMA" >"$WORK/t2.log" 2>&1 && apply twice "$SCHEMA" >"$WORK/t3.log" 2>&1; then
  [ "$(fingerprint twice)" = "$REF" ] \
    && ok "three runs back to back land in the same place as one" \
    || bad "a repeated run drifts from a single run"
else
  bad "a repeated run errors:"; grep -iE "^psql.*ERROR" "$WORK/t2.log" "$WORK/t3.log" | head -3
fi

echo
echo "=============================================================="
echo "Missing extensions are reported, not stumbled over"
echo "=============================================================="
fresh noext
psql -h /tmp -p "$PORT" -U postgres -q -d noext >/dev/null 2>&1 <<'NOEXT'
do $$ begin create role anon nologin;          exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin;  exception when duplicate_object then null; end $$;
create schema if not exists auth;
NOEXT
# No pgcrypto, no pg_trgm, and the role may not create them.
psql -h /tmp -p "$PORT" -U postgres -q -d noext -c "
do \$\$ begin create role weak nosuperuser login; exception when duplicate_object then null; end \$\$;
grant all on schema public to weak;" >/dev/null 2>&1
out=$(psql -h /tmp -p "$PORT" -U weak -v ON_ERROR_STOP=1 -q -d noext -f "$SCHEMA" 2>&1)
if echo "$out" | grep -q "Missing required extension"; then
  ok "a database without pgcrypto/pg_trgm is told exactly what to enable"
else
  bad "a database without the extensions fails obscurely instead:"
  echo "$out" | grep -iE "ERROR" | head -3
fi


echo
echo "=============================================================="
echo "Upgrading a database that carries older definitions"
echo "=============================================================="
# The real situation this was built for: a project whose functions came from
# migrations applied directly to it, in shapes this file no longer uses.
# CREATE OR REPLACE refuses to change a return type or an argument name, so
# without the drop pass these are hard stops.
fresh legacy; supabase_shape legacy
psql -h /tmp -p "$PORT" -U postgres -q -d legacy >/dev/null 2>&1 <<'OLD'
create schema if not exists mintplaza;
-- Different return type.
create function public.board_listings(p_game text) returns setof record
  language sql as 'select 1';
create function public.is_admin() returns text language sql as 'select ''no''';
-- Different argument name.
create function public.admin_set_game_active(p_game text, p_on boolean) returns void
  language sql as 'select';
-- Different arity.
create function public.console_unlock(p_passcode text, p_extra int) returns text
  language sql as 'select ''x''';
create function public.admin_reports() returns jsonb language sql as 'select ''[]''::jsonb';
-- And a composite type from an earlier draft, missing two columns.
create type mintplaza.listing_row as (listing_id uuid, game_slug text, note text);
create function public.trade_feed(p_game text, p_limit int, p_cursor timestamptz)
  returns setof mintplaza.listing_row language sql as 'select null::uuid, null::text, null::text';
OLD

if apply legacy "$SCHEMA" >"$WORK/legacy.log" 2>&1; then
  got=$(fingerprint legacy)
  [ "$got" = "$REF" ] \
    && ok "a database carrying older function and type shapes upgrades to a clean install" \
    || bad "the legacy database applied but landed somewhere different from a clean install"
  grep -qi "old shape" "$WORK/legacy.log" \
    && ok "  and it noticed the stale composite type and replaced it" \
    || echo "note  the type happened to match, so no replacement was needed"
else
  bad "a database carrying older definitions cannot be upgraded:"
  grep -iE "^psql.*ERROR" "$WORK/legacy.log" | head -3
fi

echo
echo "=============================================================="
printf 'resilience: %d passed, %d failed\n' "$pass" "$fail"
echo "=============================================================="
[ "$fail" -eq 0 ]
