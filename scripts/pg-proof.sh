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

echo
echo "All database assertions passed."
