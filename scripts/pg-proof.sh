#!/usr/bin/env bash
#
# Apply supabase/schema.sql to a throwaway Postgres and exercise the trading
# path against it.
#
#   npm run proof:db
#
# The TypeScript proof script cannot see SQL, and SQL is where this project
# keeps its hardest rules — the listing window, the slug keying, the unique
# index on a holding. Reviewing that by eye is how three bugs got in, all of
# which this script caught on its first run and none of which typechecking,
# linting or the production build would ever have noticed:
#
#   1. ALTER COLUMN ... USING with a subquery. Not allowed; the whole re-key
#      migration failed, so item_id stayed a uuid and inventory stayed broken.
#   2. A unique index over a nullable expression. NULLs are distinct in a
#      unique index, and almost every holding names no variant — so the index
#      that was meant to stop a double-tap duplicating a holding did nothing
#      at all for the common case.
#   3. A slug-shape CHECK that accepts uuids, because a uuid is also lowercase
#      letters, digits and hyphens. It would have passed exactly the value the
#      migration exists to stop.
#
# It needs a local postgres (any version from 15) and nothing else. Supabase's
# own surface — auth.uid(), the storage schema, the roles — is stubbed in
# pg-prelude.sql, so this proves the DDL and the functions, never the policies.
set -euo pipefail

BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
DATA=${PGDATA_DIR:-/tmp/mintplaza-pgproof}
PORT=${PGPORT:-55432}
HERE=$(cd "$(dirname "$0")" && pwd)

command -v "$BIN/initdb" >/dev/null || {
  echo "No Postgres at $BIN. Set PG_BIN to your installation's bin directory." >&2
  exit 1
}

# Postgres refuses to run as root, and CI containers usually are. Where that
# is the case the server is dropped to an unprivileged user; psql is happy as
# whoever, because it only connects over the socket.
AS=""
if [ "$(id -u)" = "0" ]; then
  SERVER_USER=${SERVER_USER:-nobody}
  AS="su -s /bin/sh $SERVER_USER -c"
fi
run_as() { if [ -n "$AS" ]; then $AS "$*"; else sh -c "$*"; fi; }

cleanup() { run_as "$BIN/pg_ctl -D $DATA stop -m immediate" >/dev/null 2>&1 || true; }
trap cleanup EXIT

rm -rf "$DATA"
mkdir -p "$DATA"
[ -n "$AS" ] && chown -R "$SERVER_USER" "$DATA"
run_as "$BIN/initdb -D $DATA -U postgres -A trust" >/dev/null
# Unix socket only. A throwaway test database has no business holding a TCP
# port, and a collision with anything else on the machine must not fail a run.
run_as "$BIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp -c listen_addresses=' -l $DATA/server.log start -w" >/dev/null

run() { psql -h /tmp -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 "$@"; }

# Applying the schema is noisy with "does not exist, skipping" from every
# idempotent guard, and none of it is interesting unless something fails — in
# which case the log is printed whole.
LOG="$DATA/apply.log"
run -f "$HERE/pg-prelude.sql"         >"$LOG" 2>&1 || { cat "$LOG"; exit 1; }
run -f "$HERE/../supabase/schema.sql" >"$LOG" 2>&1 || { cat "$LOG"; exit 1; }
echo "supabase/schema.sql applies clean to an empty database."
echo

# psql writes the assertions to stderr as notices, prefixed with the script
# path. The prefix is the same on every line and is just noise here.
run -f "$HERE/pg-trade-test.sql" 2>&1 | sed -E 's#^psql:[^:]*:[0-9]+: NOTICE:  ##'

# The trading path is not the whole application. This second file calls every
# function the app calls by name, on a database of its own so the trade test's
# fixtures cannot prop it up.
psql -h /tmp -p "$PORT" -U postgres -q -c 'create database appsurface' >/dev/null
runapp() { psql -h /tmp -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -d appsurface "$@"; }
runapp -f "$HERE/pg-prelude.sql"         >"$LOG" 2>&1 || { cat "$LOG"; exit 1; }
runapp -f "$HERE/../supabase/schema.sql" >"$LOG" 2>&1 || { cat "$LOG"; exit 1; }
runapp -f "$HERE/pg-app-surface-test.sql" 2>&1 | sed -E 's#^psql:[^:]*:[0-9]+: NOTICE:  ##'

# Row-level security, as the role it restricts. Its own database again, and a
# session that drops to `authenticated` — the assertions above run as the
# superuser, which bypasses RLS, so they cannot prove a policy works.
psql -h /tmp -p "$PORT" -U postgres -q -c 'create database rlscheck' >/dev/null
runrls() { psql -h /tmp -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -d rlscheck "$@"; }
runrls -f "$HERE/pg-prelude.sql"         >"$LOG" 2>&1 || { cat "$LOG"; exit 1; }
runrls -f "$HERE/../supabase/schema.sql" >"$LOG" 2>&1 || { cat "$LOG"; exit 1; }
runrls -f "$HERE/pg-rls-test.sql" 2>&1 | sed -E 's#^psql:[^:]*:[0-9]+: NOTICE:  ##'

# ---------------------------------------------------------------------------
# The Supabase shape, which the prelude deliberately does not have.
#
# On a real project the storage schema belongs to supabase_storage_admin and
# the SQL editor's role is not a member of it, so CREATE POLICY on
# storage.objects raises 42501. Unguarded that aborts the file two thirds of
# the way through and leaves the rest unapplied — and no test against a
# database we own can see it.
# ---------------------------------------------------------------------------
echo
psql -h /tmp -p "$PORT" -U postgres -q -c 'create database supashape' >/dev/null
psql -h /tmp -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -d supashape >"$LOG" 2>&1 <<'SHAPE' || { cat "$LOG"; exit 1; }
-- Supabase does not put pgcrypto and pg_trgm in public: they live in an
-- `extensions` schema, which Supabase then adds to the session search_path.
-- That combination is why a function which sets its own search_path can be
-- created without complaint and still fail the moment it calls digest() or
-- crypt(). Reproduce the layout exactly, or that whole class is invisible.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
do $$ begin create role anon nologin;          exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin;  exception when duplicate_object then null; end $$;
do $$ begin create role supabase_storage_admin nologin; exception when duplicate_object then null; end $$;
do $$ begin create role app_owner nosuperuser createrole login;  exception when duplicate_object then null; end $$;
grant all on schema public to app_owner;
grant create on database supashape to app_owner;

create schema if not exists auth;
create schema if not exists storage authorization supabase_storage_admin;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(), email text,
  raw_user_meta_data jsonb not null default '{}',
  raw_app_meta_data jsonb not null default '{}',
  created_at timestamptz not null default now());
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;

create table storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text,
  owner uuid, created_at timestamptz default now(), metadata jsonb);
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;
-- The fence: storage is somebody else's.
alter table storage.buckets owner to supabase_storage_admin;
alter table storage.objects owner to supabase_storage_admin;
alter function storage.foldername(text) owner to supabase_storage_admin;
grant usage on schema storage to app_owner, authenticated, anon;
grant select, insert, update on storage.buckets to app_owner;
grant select on storage.objects to app_owner;
grant anon, authenticated, service_role to app_owner;
grant usage on schema auth to app_owner, authenticated, anon;
grant select, insert, references on auth.users to app_owner;
grant execute on function auth.uid() to app_owner, authenticated, anon;
grant execute on function auth.jwt() to app_owner, authenticated, anon;
grant execute on function storage.foldername(text) to app_owner, authenticated, anon;
grant usage on schema extensions to app_owner, authenticated, anon;
-- Supabase sets this on its roles, which is what makes gin_trgm_ops resolve in
-- the CREATE INDEX statements while a function's own search_path does not
-- inherit it.
alter role app_owner set search_path = public, extensions;
SHAPE

if psql -h /tmp -p "$PORT" -U app_owner -q -v ON_ERROR_STOP=1 -d supashape \
     -f "$HERE/../supabase/schema.sql" >"$LOG" 2>&1; then
  echo "PASS  schema.sql applies without owning the storage schema, as on Supabase"
else
  echo "FAIL  schema.sql aborts on a real Supabase project:"
  grep -iE "^psql.*(ERROR|FATAL)" "$LOG" | head -5
  exit 1
fi

# Applying is not enough. A function that sets its own search_path is created
# happily and only fails when something calls it, so the pgcrypto path has to
# be exercised here, in the layout that breaks it, rather than assumed.
psql -h /tmp -p "$PORT" -U app_owner -q -t -A -v ON_ERROR_STOP=1 -d supashape 2>&1 <<'CALL' \
  | sed -E 's#^(psql:[^:]*:[0-9]+: )?NOTICE:  ##' | grep -E '^(PASS|FAIL|ERROR)'
create or replace function pg_temp.ok(label text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'PASS  %', label;
  else raise exception 'FAIL  %', label;
  end if;
end $$;

insert into auth.users (id, email)
values ('aaaaaaaa-0000-0000-0000-00000000000a', 'owner@x.test');
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000000a';
select public.ensure_profile();
update public.profiles set username = 'Owner'
 where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
insert into mintplaza.admin_allowlist (roblox_username) values ('owner');
select public.ensure_profile();

do $$
declare v_token text;
begin
  perform pg_temp.ok('the owner binds with pgcrypto in extensions', public.is_admin());

  -- Each of these four reaches for crypt, gen_salt, gen_random_bytes or
  -- digest. With `extensions` missing from their search_path every one raises
  -- 42883 "function digest(text, unknown) does not exist".
  perform mintplaza.set_console_passcode('open-sesame');
  perform pg_temp.ok('set_console_passcode finds crypt()', true);

  v_token := public.console_unlock('open-sesame');
  perform pg_temp.ok('console_unlock finds gen_random_bytes() and digest()',
    v_token is not null);
  perform pg_temp.ok('console_unlocked finds digest()',
    public.console_unlocked(v_token));

  perform public.console_lock(v_token);
  perform pg_temp.ok('console_lock finds digest()',
    public.console_unlocked(v_token) = false);
end $$;
CALL

echo
echo "All database assertions passed."
