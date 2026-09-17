-- Row-level security, checked as the role it is meant to restrict.
--
-- This file exists because the other two prove less than they appear to. They
-- run as the superuser, and a superuser bypasses RLS entirely — so every
-- "the wrong person cannot do this" assertion made there passes whether the
-- policy works or not. The ones here run as `authenticated`, holding exactly
-- the blanket table grants Supabase gives that role, which makes RLS the only
-- thing standing between a signed-in player and every row in the database.
--
-- Run through scripts/pg-proof.sh.
\set ON_ERROR_STOP on

create or replace function pg_temp.ok(label text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'PASS  %', label;
  else raise exception 'FAIL  %', label;
  end if;
end $$;

-- What Supabase actually hands out. Without this the test would "pass" by
-- lacking table privileges rather than by the policies working.
grant usage on schema public to anon, authenticated;
grant all privileges on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage on all sequences in schema public to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@x.test'),
  ('22222222-2222-2222-2222-222222222222', 'mallory@x.test');
update public.profiles set username = 'alice',   last_seen_at = now()
 where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set username = 'mallory', last_seen_at = now()
 where id = '22222222-2222-2222-2222-222222222222';

-- Alice's things. Mallory will try to touch every one of them.
insert into public.service_listings (id, game_slug, author_id, side, service_ids, expires_at)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'blox-fruits',
        '11111111-1111-1111-1111-111111111111', 'offer', '{bf-raid}',
        now() + interval '90 minutes');
insert into public.inventory_entries (user_id, game_slug, item_id, kind)
values ('11111111-1111-1111-1111-111111111111', 'blox-fruits', 'bf-kitsune', 'have');
insert into public.reports (reporter_id, subject_type, subject_id, reason)
values ('11111111-1111-1111-1111-111111111111', 'user',
        '22222222-2222-2222-2222-222222222222', 'scam');
insert into public.trade_listings (id, user_id, game_slug, note)
values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        '11111111-1111-1111-1111-111111111111', 'blox-fruits', 'alice note');
insert into public.support_messages (id, user_id, body)
values ('ffffffff-ffff-ffff-ffff-ffffffffffff',
        '11111111-1111-1111-1111-111111111111', 'alice cannot load the board');

-- ---------------------------------------------------------------------------
\echo ''
\echo 'POLICY HELPERS ARE CALLABLE'
--
-- A policy expression is evaluated as whoever is querying. If it calls a
-- function that role cannot EXECUTE, the read raises "permission denied for
-- function" instead of returning no rows — a hard error on a page that should
-- simply have rendered empty. This is how the entire messaging feature became
-- unreadable, so the rule is checked mechanically rather than remembered:
-- every function named in a policy, and in any CHECK constraint, must be
-- callable by both anon and authenticated.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  broken text[] := '{}';
  checked int := 0;
begin
  for r in
    -- Every function named in a policy expression, resolved to the real
    -- pg_proc row rather than guessed at by arity.
    select distinct c.relname, p.polname, pr.oid as fnoid,
           pn.nspname || '.' || pr.proname as fname
      from pg_policy p
      join pg_class c       on c.oid = p.polrelid
      join pg_namespace n   on n.oid = c.relnamespace
      cross join lateral regexp_matches(
        coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
        coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''),
        '(public|mintplaza)\.([a-z_0-9]+)\s*\(', 'g') m
      join pg_namespace pn  on pn.nspname = m[1]
      join pg_proc pr       on pr.proname = m[2] and pr.pronamespace = pn.oid
     where n.nspname = 'public'
  loop
    checked := checked + 1;
    if not has_function_privilege('anon', r.fnoid, 'EXECUTE')
       or not has_function_privilege('authenticated', r.fnoid, 'EXECUTE') then
      broken := array_append(broken,
        r.relname || '.' || r.polname || ' calls ' || r.fname);
    end if;
  end loop;

  perform pg_temp.ok(
    format('all %s functions named in a policy are callable by anon and authenticated%s',
      checked,
      case when broken = '{}' then '' else ' — NOT: ' || array_to_string(broken, '; ') end),
    broken = '{}' and checked > 0);
end $$;

-- ---------------------------------------------------------------------------
\echo ''
\echo 'RLS — AS A STRANGER'
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$
declare n int;
begin
  -- Reads. A policy that returns nothing is the correct outcome here; an error
  -- would also be safe but would break a page that has every right to render.
  select count(*) into n from public.inventory_entries;
  perform pg_temp.ok('another player''s inventory is invisible', n = 0);

  select count(*) into n from public.reports;
  perform pg_temp.ok('another player''s report is invisible', n = 0);

  select count(*) into n from public.profiles;
  perform pg_temp.ok('profiles stay public, which is the design', n >= 2);

  -- These three read through a policy that calls a helper function. They are
  -- here because they used to raise rather than return nothing, which took the
  -- whole messaging feature down for every signed-in player.
  select count(*) into n from public.messages;
  perform pg_temp.ok('messages read as empty rather than erroring', n = 0);

  select count(*) into n from public.conversations;
  perform pg_temp.ok('conversations read as empty rather than erroring', n = 0);

  select count(*) into n from public.conversation_participants;
  perform pg_temp.ok('participants read as empty rather than erroring', n = 0);

  -- A support message can name a bug, a username, or anything else the sender
  -- was in the middle of. It is theirs and the owner's, nobody else's.
  select count(*) into n from public.support_messages;
  perform pg_temp.ok('another player''s support message is invisible', n = 0);
end $$;

do $$
declare n int;
begin
  update public.support_messages set status = 'closed'
   where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  get diagnostics n = row_count;
  perform pg_temp.ok('a stranger cannot close somebody''s support message', n = 0);

  delete from public.support_messages
   where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  get diagnostics n = row_count;
  perform pg_temp.ok('a stranger cannot delete one either', n = 0);
end $$;

do $$ begin
  insert into public.support_messages (user_id, body)
  values ('11111111-1111-1111-1111-111111111111', 'forged, from someone else');
  perform pg_temp.ok('a stranger cannot send one in somebody else''s name', false);
exception when insufficient_privilege then
  perform pg_temp.ok('a stranger cannot send one in somebody else''s name', true);
end $$;

-- Writes. Each has to end in zero rows or a refusal.
do $$
declare n int;
begin
  delete from public.service_listings
   where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  get diagnostics n = row_count;
  perform pg_temp.ok('a stranger cannot delete somebody''s board post', n = 0);

  update public.service_listings set stage = 'locked'
   where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  get diagnostics n = row_count;
  perform pg_temp.ok('a stranger cannot restage somebody''s board post', n = 0);

  update public.trade_listings set note = 'hijacked'
   where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  get diagnostics n = row_count;
  perform pg_temp.ok('a stranger cannot edit somebody''s trade listing', n = 0);

  update public.profiles set username = 'alice2'
   where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  perform pg_temp.ok('a stranger cannot rename somebody''s profile', n = 0);
end $$;

do $$ begin
  insert into public.service_votes (listing_id, user_id)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
          '11111111-1111-1111-1111-111111111111');
  perform pg_temp.ok('a stranger cannot vote as somebody else', false);
exception when insufficient_privilege or check_violation or raise_exception then
  perform pg_temp.ok('a stranger cannot vote as somebody else', true);
end $$;

do $$ begin
  insert into public.service_picks (listing_id, user_id)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
          '22222222-2222-2222-2222-222222222222');
  perform pg_temp.ok('a stranger cannot pick a team on somebody''s post', false);
exception when insufficient_privilege or foreign_key_violation then
  perform pg_temp.ok('a stranger cannot pick a team on somebody''s post', true);
end $$;

do $$ begin
  insert into public.service_comments (listing_id, author_id, body)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
          '22222222-2222-2222-2222-222222222222', 'hello');
  perform pg_temp.ok('somebody who has not voted cannot post in the thread', false);
exception when insufficient_privilege then
  perform pg_temp.ok('somebody who has not voted cannot post in the thread', true);
end $$;

do $$ begin
  insert into public.service_listings (game_slug, author_id, side, service_ids, expires_at)
  values ('blox-fruits', '11111111-1111-1111-1111-111111111111', 'offer', '{x}',
          now() + interval '1 hour');
  perform pg_temp.ok('a stranger cannot post as somebody else', false);
exception when insufficient_privilege then
  perform pg_temp.ok('a stranger cannot post as somebody else', true);
end $$;

do $$ begin
  insert into public.inventory_entries (user_id, game_slug, item_id, kind)
  values ('11111111-1111-1111-1111-111111111111', 'blox-fruits', 'bf-magnet', 'want');
  perform pg_temp.ok('a stranger cannot write into somebody''s inventory', false);
exception when insufficient_privilege then
  perform pg_temp.ok('a stranger cannot write into somebody''s inventory', true);
end $$;

-- The private schema. Nothing here should be reachable at all.
do $$
declare n int;
begin
  select count(*) into n from mintplaza.admin_allowlist;
  perform pg_temp.ok('the admin allowlist is unreachable by a player', false);
exception when insufficient_privilege or undefined_table then
  perform pg_temp.ok('the admin allowlist is unreachable by a player', true);
end $$;

do $$
declare n int;
begin
  select count(*) into n from mintplaza.console_secret;
  perform pg_temp.ok('the console passcode is unreachable by a player', false);
exception when insufficient_privilege or undefined_table then
  perform pg_temp.ok('the console passcode is unreachable by a player', true);
end $$;

-- A player must not be able to make themselves the owner.
do $$ begin
  insert into mintplaza.admin_allowlist (roblox_username, roblox_user_id)
  values ('mallory', '2');
  perform pg_temp.ok('a player cannot add themselves to the allowlist', false);
exception when insufficient_privilege or undefined_table then
  perform pg_temp.ok('a player cannot add themselves to the allowlist', true);
end $$;

-- ---------------------------------------------------------------------------
\echo ''
\echo 'RLS — AS THE OWNER OF THE ROWS'
-- ---------------------------------------------------------------------------
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare n int;
begin
  select count(*) into n from public.inventory_entries;
  perform pg_temp.ok('a player still sees their own inventory', n = 1);

  update public.service_listings set stage = 'requested'
   where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  get diagnostics n = row_count;
  perform pg_temp.ok('the author can restage their own post', n = 1);

  select count(*) into n from public.reports;
  perform pg_temp.ok('a reporter can see the report they filed', n = 1);

  select count(*) into n from public.support_messages;
  perform pg_temp.ok('and their own support message', n = 1);

  insert into public.inventory_entries (user_id, game_slug, item_id, kind)
  values ('11111111-1111-1111-1111-111111111111', 'blox-fruits', 'bf-magnet', 'want');
  perform pg_temp.ok('a player can add to their own inventory', true);
end $$;

-- ---------------------------------------------------------------------------
\echo ''
\echo 'RLS — SIGNED OUT'
-- ---------------------------------------------------------------------------
reset role;
set role anon;
reset request.jwt.claim.sub;

do $$
declare n int;
begin
  select count(*) into n from public.inventory_entries;
  perform pg_temp.ok('a signed-out visitor sees no inventory at all', n = 0);

  select count(*) into n from public.reports;
  perform pg_temp.ok('a signed-out visitor sees no reports', n = 0);

  select count(*) into n from public.messages;
  perform pg_temp.ok('a signed-out visitor sees no messages', n = 0);

  select count(*) into n from public.conversations;
  perform pg_temp.ok('a signed-out visitor sees no conversations', n = 0);

  select count(*) into n from public.support_messages;
  perform pg_temp.ok('a signed-out visitor sees no support messages', n = 0);
end $$;

do $$ begin
  insert into public.service_listings (game_slug, author_id, side, service_ids, expires_at)
  values ('blox-fruits', '11111111-1111-1111-1111-111111111111', 'offer', '{x}',
          now() + interval '1 hour');
  perform pg_temp.ok('a signed-out visitor cannot post', false);
exception when insufficient_privilege then
  perform pg_temp.ok('a signed-out visitor cannot post', true);
end $$;

reset role;
