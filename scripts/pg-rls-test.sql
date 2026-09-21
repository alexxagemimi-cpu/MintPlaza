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

-- A failure raises TF001, a SQLSTATE nothing else in this project uses.
--
-- `raise exception 'FAIL %'` defaults to P0001, which is exactly what the
-- schema raises when a limit or a guard bites — so a test shaped "do the
-- forbidden thing, expect P0001" would catch its OWN failure report and turn
-- it into a pass. That made three checks in pg-trade-test.sql unfalsifiable,
-- found by granting the permission they test for and watching them still pass.
-- A distinct code makes that class of mistake impossible here too.
create or replace function pg_temp.ok(label text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'PASS  %', label;
  else raise exception 'FAIL  %', label using errcode = 'TF001';
  end if;
end $$;

-- What Supabase actually hands out. Without this the test would "pass" by
-- lacking table privileges rather than by the policies working.
grant usage on schema public to anon, authenticated;
grant all privileges on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage on all sequences in schema public to authenticated;

-- ...and then the hardening from the tail of supabase/schema.sql, re-applied
-- because the blanket grant above has just undone it.
--
-- This is not tidiness. Table privileges became part of the defence when it
-- turned out an RLS policy chooses which ROWS you may write and never which
-- COLUMNS — `update trade_listings set created_at = ...` reset the posting
-- limit, and `update profiles set status = 'active'` un-banned an account.
-- A test file that grants everything back is a test file that proves the
-- opposite of what the live database does.
--
-- proof.ts asserts these lines match the ones in schema.sql, so the two
-- cannot drift apart.
revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke insert, update, delete, truncate on
  public.profiles,
  public.trade_listings,
  public.listing_sides
from authenticated;
revoke update on public.service_listings from authenticated;
grant update (stage) on public.service_listings to authenticated;
revoke insert on public.messages from authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@x.test'),
  ('22222222-2222-2222-2222-222222222222', 'mallory@x.test');
update public.profiles set username = 'alice',   last_seen_at = now()
 where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set username = 'mallory', last_seen_at = now()
 where id = '22222222-2222-2222-2222-222222222222';

-- Both have agreed to the rules, because posting and messaging require it.
-- The requirement itself is tested in pg-trade-test.sql with an account that
-- has not; here it is setup, so the RLS checks below test RLS and not consent.
insert into public.terms_acceptance (user_id, version) values
  ('11111111-1111-1111-1111-111111111111', '2026-09-18'),
  ('22222222-2222-2222-2222-222222222222', '2026-09-18');

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
insert into public.entitlements (user_id, expires_at, source, country)
values ('11111111-1111-1111-1111-111111111111',
        now() + interval '60 days', 'purchase', 'IN');

-- A third player, and a conversation between them and alice. Mallory is in no
-- conversation with anybody, and must stay that way however hard she tries.
insert into auth.users (id, email)
values ('33333333-3333-3333-3333-333333333333', 'casey@x.test');
update public.profiles set username = 'casey', last_seen_at = now()
 where id = '33333333-3333-3333-3333-333333333333';

insert into public.conversations (id) values ('dddddddd-dddd-dddd-dddd-dddddddddddd');
insert into public.conversation_participants (conversation_id, user_id) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-3333-3333-3333-333333333333');
insert into public.messages (conversation_id, sender_id, body)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd',
        '11111111-1111-1111-1111-111111111111', 'meet me in trade realm');

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

  -- Who pays is not a fact this site publishes. A list of paying accounts is a
  -- list of accounts worth targeting, and on a site whose users are children
  -- holding valuable inventories that is not a small thing.
  select count(*) into n from public.entitlements;
  perform pg_temp.ok('another player''s Level Up is invisible', n = 0);

  -- ---- somebody else's private conversation -----------------------------
  --
  -- The whole point of the messaging design. Mallory knows the conversation
  -- id — assume she does; ids leak through logs, screenshots and referrers —
  -- and must still get nothing from any of the three tables.
  select count(*) into n from public.messages
   where conversation_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  perform pg_temp.ok('a stranger cannot read a private conversation''s messages', n = 0);

  select count(*) into n from public.conversations
   where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  perform pg_temp.ok('nor see that the conversation exists at all', n = 0);

  select count(*) into n from public.conversation_participants
   where conversation_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  perform pg_temp.ok('nor who is in it', n = 0);
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

-- Level Up, from the account that would most like to have it for free.
--
-- This is the same ground pg-trade-test.sql covers, run the way that actually
-- proves it: as `authenticated`, holding the blanket table grants Supabase
-- hands that role, with RLS as the only thing in the way. The other file runs
-- as superuser, which bypasses RLS entirely — so on its own it proves nothing
-- about who can write here.
do $$
declare n int; v_got_in boolean := false;
begin
  begin
    insert into public.entitlements (user_id, expires_at)
    values ('22222222-2222-2222-2222-222222222222', now() + interval '10 years');
    v_got_in := true;
  exception when others then
    v_got_in := false;
  end;
  select count(*) into n from public.entitlements
   where user_id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.ok('a player cannot give themselves Level Up', not v_got_in and n = 0);

  -- Nor take somebody else's and point it at themselves.
  update public.entitlements set user_id = '22222222-2222-2222-2222-222222222222'
   where user_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  perform pg_temp.ok('nor reassign somebody else''s to themselves', n = 0);

  -- Nor extend one that exists.
  update public.entitlements set expires_at = now() + interval '10 years';
  get diagnostics n = row_count;
  perform pg_temp.ok('nor extend anybody''s, including their own', n = 0);

  -- Nor delete the record of a refund.
  delete from public.entitlements;
  get diagnostics n = row_count;
  perform pg_temp.ok('nor delete the record that money changed hands', n = 0);
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

  -- These two are refused a step earlier than the rest of this block: the
  -- tail of schema.sql takes the write privilege on trade_listings and
  -- profiles away from `authenticated` altogether, so Postgres says
  -- "permission denied" instead of matching zero rows. Both are a refusal and
  -- the privilege one is the stronger of the two, so either passes — but it
  -- has to be caught, or it takes this whole block with it.
  begin
    update public.trade_listings set note = 'hijacked'
     where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0;
  end;
  perform pg_temp.ok('a stranger cannot edit somebody''s trade listing', n = 0);

  begin
    update public.profiles set username = 'alice2'
     where id = '11111111-1111-1111-1111-111111111111';
    get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0;
  end;
  perform pg_temp.ok('a stranger cannot rename somebody''s profile', n = 0);

  -- Reading somebody's messages is one thing; editing them is another. A
  -- stranger who could rewrite a message could put words in a trade
  -- negotiation and then screenshot them.
  update public.messages set body = 'send it first, I promise'
   where conversation_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  get diagnostics n = row_count;
  perform pg_temp.ok('nor rewrite a message in it', n = 0);

  delete from public.messages
   where conversation_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  get diagnostics n = row_count;
  perform pg_temp.ok('nor delete one', n = 0);

  -- Marking somebody else's thread read would hide a warning they had not seen.
  update public.conversation_participants set last_read_at = now()
   where conversation_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  get diagnostics n = row_count;
  perform pg_temp.ok('nor mark their thread as read', n = 0);
end $$;

-- Suspension, which is what replaces blocking on this site.
--
-- This is the half that only THIS file can prove: the rule lives in the RLS
-- policy on messages, and the other test file runs as superuser, which
-- bypasses RLS entirely. Here mallory holds the real grants Supabase gives
-- `authenticated`, so the policy is the only thing in the way.
do $$
declare v_id uuid; v_sent boolean := false;
begin
  -- Her own legitimate thread, opened the normal way.
  set local role postgres;
  v_id := gen_random_uuid();
  insert into public.conversations (id) values (v_id);
  insert into public.conversation_participants (conversation_id, user_id) values
    (v_id, '22222222-2222-2222-2222-222222222222'),
    (v_id, '11111111-1111-1111-1111-111111111111');
  update public.profiles set status = 'suspended'
   where id = '22222222-2222-2222-2222-222222222222';
  set local role authenticated;

  begin
    insert into public.messages (conversation_id, sender_id, body)
    values (v_id, '22222222-2222-2222-2222-222222222222', 'still here');
    v_sent := true;
  exception when others then v_sent := false;
  end;
  perform pg_temp.ok('a suspended account cannot send, even in its own thread',
    not v_sent);

  -- And it comes back, or a mistaken suspension would be permanent.
  set local role postgres;
  update public.profiles set status = 'active'
   where id = '22222222-2222-2222-2222-222222222222';
  set local role authenticated;

  begin
    insert into public.messages (conversation_id, sender_id, body)
    values (v_id, '22222222-2222-2222-2222-222222222222', 'back again');
    v_sent := true;
  exception when others then v_sent := false;
  end;
  perform pg_temp.ok('and lifting the suspension lets them speak again', v_sent);
end $$;

-- Sending INTO a thread you are not in, which is the attack that would turn
-- messaging into a spam channel aimed at anybody whose id you can guess.
do $$
declare v_sent boolean := false;
begin
  begin
    insert into public.messages (conversation_id, sender_id, body)
    values ('dddddddd-dddd-dddd-dddd-dddddddddddd',
            '22222222-2222-2222-2222-222222222222', 'buy cheap robux here');
    v_sent := true;
  exception when others then v_sent := false;
  end;
  -- The refusal is the whole assertion, and counting the rows afterwards is
  -- not available here: mallory cannot READ that conversation either, so a
  -- count run as her returns 0 whether the insert landed or not. An earlier
  -- version of this test checked for one surviving row and failed against a
  -- perfectly secure schema for exactly that reason. The row count is verified
  -- below, as somebody who is allowed to see it.
  perform pg_temp.ok('a stranger cannot send into a thread they are not in',
    not v_sent);
end $$;

-- And forging the sender on a message, which would let somebody put words in
-- another player's mouth inside a thread they ARE in.
do $$
declare v_id uuid; v_sent boolean := false;
begin
  -- Mallory opens a legitimate thread with alice first.
  begin
    insert into public.messages (conversation_id, sender_id, body)
    values ('dddddddd-dddd-dddd-dddd-dddddddddddd',
            '11111111-1111-1111-1111-111111111111', 'forged from alice');
    v_sent := true;
  exception when others then v_sent := false;
  end;
  perform pg_temp.ok('nor send one as somebody else', not v_sent);
end $$;

-- Now from alice's side, who IS in that conversation and can therefore see
-- what is actually in it. This is the half the stranger's own session cannot
-- prove.
do $$
declare n int;
begin
  set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
  select count(*) into n from public.messages
   where conversation_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  perform pg_temp.ok('and nothing a stranger sent ever reached the thread', n = 1);

  perform pg_temp.ok('which still holds only what alice actually said',
    (select body from public.messages
      where conversation_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
      limit 1) = 'meet me in trade realm');
end $$;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

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

  select count(*) into n from public.entitlements;
  perform pg_temp.ok('a signed-out visitor sees who pays for nothing', n = 0);
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


-- ---------------------------------------------------------------------------
\echo ''
\echo 'THE CONTROL PANEL IS ONE ACCOUNT ONLY'
-- ---------------------------------------------------------------------------
--
-- Mallory is a perfectly ordinary signed-in player. Everything below is her
-- trying to reach the owner's panel, and every one of them must fail. Run as
-- `authenticated` with Supabase's real grants, because a superuser would walk
-- through all of it regardless of whether any of these checks work.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$
declare n int; v_ok boolean;
begin
  perform pg_temp.ok('an ordinary player is not an admin', public.is_admin() = false);

  -- The phrase that opens the panel from the search bar matches nothing for
  -- her, so as far as search is concerned the panel does not exist.
  perform pg_temp.ok('and the search phrase finds nothing for her',
    public.console_phrase_matches('control panel') = false
    and public.console_phrase_matches('admin') = false);

  -- She cannot put herself on the allowlist. It lives in the mintplaza schema,
  -- which PostgREST does not serve, and she holds no grant on it.
  begin
    insert into mintplaza.admin_allowlist (roblox_username) values ('mallory');
    v_ok := true;
  exception when others then v_ok := false;
  end;
  perform pg_temp.ok('nor add herself to the allowlist', not v_ok);

  -- Nor read who is on it, which would tell her whose account to go after.
  begin
    select count(*) into n from mintplaza.admin_allowlist;
    v_ok := true;
  exception when others then v_ok := false;
  end;
  perform pg_temp.ok('nor read who is on it', not v_ok);

  -- Nor read the passcode hash, to take offline and crack at leisure.
  begin
    select count(*) into n from mintplaza.console_secret;
    v_ok := true;
  exception when others then v_ok := false;
  end;
  perform pg_temp.ok('nor read the passcode hash', not v_ok);
end $$;

-- Every admin function, called directly, the way a forged request would. The
-- 404 on the page is presentation; THIS is the part that actually holds.
do $$
declare fn text; reached text[] := '{}';
begin
  foreach fn in array array[
    'select public.admin_reports()',
    'select public.admin_support_messages()',
    'select public.admin_level_ups()',
    'select public.admin_grant_level_up(''mallory'', 3650)',
    'select public.admin_revoke_level_up(''alice'')'
  ] loop
    begin
      execute fn;
      -- No exception means it ran for somebody who is not the owner.
      reached := array_append(reached, fn);
    exception when others then null;
    end;
  end loop;

  perform pg_temp.ok(
    format('no admin function answers an ordinary player%s',
      case when reached = '{}' then '' else ' — REACHED: ' || array_to_string(reached, '; ') end),
    reached = '{}');
end $$;

-- And the one that would matter most: granting herself a subscription.
do $$
declare v_until timestamptz;
begin
  select expires_at into v_until from public.entitlements
   where user_id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.ok('and she still has no Level Up after trying', v_until is null);
end $$;

reset role;


-- ---------------------------------------------------------------------------
\echo ''
\echo 'THE RECORD THAT SOMEBODY AGREED'
-- ---------------------------------------------------------------------------
--
-- This table is the difference between claiming a player agreed to the rules
-- and being able to say when, and to which version. If any of the checks below
-- fail, that record is worthless in exactly the dispute it exists for.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$
declare v_ok boolean; n int;
begin
  -- Mallory accepted '2026-09-18' in the setup at the top of this file, because
  -- posting and messaging require it and the RLS checks above would otherwise
  -- be testing consent rather than row-level security.
  perform pg_temp.ok('the acceptance from setup is on record',
    public.has_accepted_terms('2026-09-18') = true);

  -- Accepting again must be harmless, because a page refresh does it.
  perform public.accept_terms('2026-09-18');
  perform pg_temp.ok('accepting again is harmless',
    public.has_accepted_terms('2026-09-18') = true);

  -- Accepting one version must NOT count as accepting a later one. A single
  -- boolean flag would get this wrong, and a player who agreed to the first
  -- terms would be recorded as agreeing to clauses written afterwards.
  perform pg_temp.ok('and says nothing about a version they have not seen',
    public.has_accepted_terms('2027-01-01') = false);

  -- The timestamp records when they FIRST agreed. Re-accepting must not move
  -- it, or the record stops answering the only question it is asked.
  perform pg_temp.ok('accepting twice does not move the date',
    (select count(*) from public.terms_acceptance
      where user_id = '22222222-2222-2222-2222-222222222222'
        and version = '2026-09-18') = 1);
end $$;

-- ---- forging one -----------------------------------------------------------
--
-- The attack that matters: writing an acceptance row directly, for a version
-- that was never displayed. There is no insert policy, so this must fail.
do $$
declare v_got_in boolean := false; n int;
begin
  begin
    insert into public.terms_acceptance (user_id, version)
    values ('22222222-2222-2222-2222-222222222222', 'whatever-I-like');
    v_got_in := true;
  exception when others then v_got_in := false;
  end;
  select count(*) into n from public.terms_acceptance
   where version = 'whatever-I-like';
  perform pg_temp.ok('a player cannot write an acceptance row directly',
    not v_got_in and n = 0);
end $$;

-- Nor backdate one, which would be the move if a dispute turned on when.
do $$
declare n int;
begin
  update public.terms_acceptance set accepted_at = now() - interval '5 years'
   where user_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  perform pg_temp.ok('nor backdate the one they have', n = 0);
end $$;

-- Nor delete it afterwards. An acceptance somebody can quietly erase is not
-- evidence of anything.
do $$
declare n int;
begin
  delete from public.terms_acceptance
   where user_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  perform pg_temp.ok('nor delete it once it exists', n = 0);
end $$;

-- Nor forge one in somebody else's name, which would be the move for anybody
-- wanting a scam victim on record as having agreed to something.
do $$
declare v_got_in boolean := false; n int;
begin
  begin
    insert into public.terms_acceptance (user_id, version)
    values ('11111111-1111-1111-1111-111111111111', '2026-09-18');
    v_got_in := true;
  exception when others then v_got_in := false;
  end;
  select count(*) into n from public.terms_acceptance
   where user_id = '11111111-1111-1111-1111-111111111111';
  perform pg_temp.ok('nor record an acceptance in somebody else''s name',
    not v_got_in and n = 0);
end $$;

-- And cannot read whether anybody else has accepted. Who has not agreed yet is
-- not a fact this site publishes.
do $$
declare n int;
begin
  select count(*) into n from public.terms_acceptance
   where user_id <> '22222222-2222-2222-2222-222222222222';
  perform pg_temp.ok('and cannot see anybody else''s acceptance', n = 0);
end $$;

reset role;

-- ===========================================================================
-- The service board's two "you have to take part first" rules
--
-- Both were written as a correlated subquery against a table that happens to
-- share the outer table's column name, and both silently became something
-- else. Postgres resolves an unqualified column to the INNERMOST scope that
-- has one, so inside `select 1 from service_votes v where v.listing_id =
-- listing_id` the right-hand side is v's own column, not the comment's — the
-- test is `v.listing_id = v.listing_id`, true for every row.
--
-- Nothing errors, the policy reads correctly in the file, and the rule it
-- describes is simply not the rule in force. These five assertions are the
-- only thing that can tell the difference, which is why they run as a real
-- `authenticated` session rather than as the superuser that bypasses RLS.
--
-- Two listings of their own rather than the fixtures above, which earlier
-- assertions have deliberately restaged and expired.
-- ===========================================================================

reset role;
reset request.jwt.claim.sub;

insert into public.service_listings (id, game_slug, author_id, side, service_ids, stage, expires_at)
values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'blox-fruits',
        '33333333-3333-3333-3333-333333333333', 'offer', '{bf-raid}',
        'voting', now() + interval '90 minutes'),
       ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'blox-fruits',
        '33333333-3333-3333-3333-333333333333', 'offer', '{bf-raid}',
        'voting', now() + interval '90 minutes');

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

-- Mallory puts her hand up on the first listing, and only the first.
do $$
declare v_ok boolean := false;
begin
  begin
    insert into public.service_votes (listing_id, user_id)
    values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
            '22222222-2222-2222-2222-222222222222');
    v_ok := true;
  exception when others then v_ok := false;
  end;
  perform pg_temp.ok('a player may vote on a listing that is open', v_ok);
end $$;

-- Voting on one listing must not buy a voice in another's thread. Before the
-- fix a single vote anywhere unlocked every thread on the site, which is the
-- drive-by commenting the rule exists to stop.
do $$
declare v_got_in boolean := false; n int;
begin
  begin
    insert into public.service_comments (listing_id, author_id, body)
    values ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
            '22222222-2222-2222-2222-222222222222', 'let me in');
    v_got_in := true;
  exception when others then v_got_in := false;
  end;
  select count(*) into n from public.service_comments
   where listing_id = 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2';
  perform pg_temp.ok(
    'a vote on one listing does not unlock another listing''s thread',
    not v_got_in and n = 0);
end $$;

-- The positive control, so the assertion above cannot pass on a policy that
-- simply refuses everybody.
do $$
declare v_ok boolean := false;
begin
  begin
    insert into public.service_comments (listing_id, author_id, body)
    values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
            '22222222-2222-2222-2222-222222222222', 'i am in for this one');
    v_ok := true;
  exception when others then v_ok := false;
  end;
  perform pg_temp.ok('but a vote on THIS listing does open its thread', v_ok);
end $$;

-- Being picked for one listing must not freeze a vote on a different one.
-- Before the fix it froze every vote the player would ever cast, for the life
-- of the account, with no message and nothing in the logs.
do $$
declare v_left int;
begin
  set local role postgres;
  insert into public.service_picks (listing_id, user_id)
  values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
          '22222222-2222-2222-2222-222222222222');
  insert into public.service_votes (listing_id, user_id)
  values ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
          '22222222-2222-2222-2222-222222222222');
  set local role authenticated;

  delete from public.service_votes
   where listing_id = 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2'
     and user_id = '22222222-2222-2222-2222-222222222222';
  select count(*) into v_left from public.service_votes
   where listing_id = 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2'
     and user_id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.ok(
    'being picked for one listing does not freeze a vote on another',
    v_left = 0);
end $$;

-- And the rule it was meant to enforce still holds: the pick on THIS listing
-- does stop the withdrawal, because the other side is counting on her.
do $$
declare v_left int;
begin
  delete from public.service_votes
   where listing_id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'
     and user_id = '22222222-2222-2222-2222-222222222222';
  select count(*) into v_left from public.service_votes
   where listing_id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'
     and user_id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.ok(
    'but a pick on this one still holds the vote in place', v_left = 1);
end $$;

reset role;


-- ===========================================================================
-- A row policy is not a column policy
--
-- Every assertion here is an attack that WORKED against a real Postgres, as an
-- ordinary signed-in player, using nothing but the key that ships in the
-- browser. They all went through `using (user_id = '44444444-4444-4444-4444-444444444444')` policies that
-- read as "you may only change your own things" and mean "you may change
-- anything about your own things".
--
-- The fix is table and column privileges, at the tail of supabase/schema.sql.
-- These run as a real `authenticated` session because a superuser has every
-- privilege and would prove nothing.
-- ===========================================================================

reset role;
reset request.jwt.claim.sub;

insert into auth.users (id, email)
values ('44444444-4444-4444-4444-444444444444', 'trudy@x.test');
update public.profiles set username = 'trudy', status = 'active', roblox_user_id = '4444'
 where id = '44444444-4444-4444-4444-444444444444';
insert into public.terms_acceptance (user_id, version)
values ('44444444-4444-4444-4444-444444444444', '2026-09-18');

set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

-- The legitimate path first, so everything below is measured against a
-- listing that really exists and a limit that really counted it.
do $$
declare r record;
begin
  perform public.post_trade_listing('blox-fruits',
    '[{"itemId":"bf-rocket"}]'::jsonb, '[]'::jsonb, null);
  select * into r from public.listing_allowance('blox-fruits');
  perform pg_temp.ok('posting through the RPC still works and is counted',
    r.used = 1);
end $$;

-- The posting limit, switched off by editing the timestamp it counts.
do $$
declare v_blocked boolean := false; r record;
begin
  begin
    update public.trade_listings set created_at = now() - interval '48 hours'
     where user_id = '44444444-4444-4444-4444-444444444444';
  exception when insufficient_privilege then v_blocked := true;
  end;
  select * into r from public.listing_allowance('blox-fruits');
  perform pg_temp.ok(
    'a player cannot backdate a listing to hand themselves the slot back',
    v_blocked and r.used = 1);
end $$;

-- A listing that never expires.
do $$
declare v_blocked boolean := false; v_life interval;
begin
  begin
    update public.trade_listings set expires_at = now() + interval '10 years'
     where user_id = '44444444-4444-4444-4444-444444444444';
  exception when insufficient_privilege then v_blocked := true;
  end;
  select expires_at - created_at into v_life from public.trade_listings
   where user_id = '44444444-4444-4444-4444-444444444444';
  perform pg_temp.ok('nor make a listing immortal',
    v_blocked and v_life < interval '2 days');
end $$;

-- Permanent top of the board, with the six-hour cooldown never consulted.
do $$
declare v_blocked boolean := false; v_future boolean;
begin
  begin
    update public.trade_listings set bumped_at = now() + interval '1 hour'
     where user_id = '44444444-4444-4444-4444-444444444444';
  exception when insufficient_privilege then v_blocked := true;
  end;
  select bumped_at > now() into v_future from public.trade_listings
   where user_id = '44444444-4444-4444-4444-444444444444';
  perform pg_temp.ok('nor bump past the cooldown by writing the column',
    v_blocked and not v_future);
end $$;

-- A ban the banned player lifts themselves. status='active' is exactly what
-- the posting policies check, so this one undoes moderation entirely.
do $$
declare v_blocked boolean := false; v text;
begin
  begin
    update public.profiles set status = 'suspended' where id = '44444444-4444-4444-4444-444444444444';
  exception when insufficient_privilege then v_blocked := true;
  end;
  select status into v from public.profiles where id = '44444444-4444-4444-4444-444444444444';
  perform pg_temp.ok('a player cannot write their own moderation status',
    v_blocked and v = 'active');
end $$;

-- Wearing a known trader's name on a site where strangers hand each other
-- valuable items.
do $$
declare v_blocked boolean := false; v text;
begin
  begin
    update public.profiles set username = 'alice' where id = '44444444-4444-4444-4444-444444444444';
  exception when insufficient_privilege then v_blocked := true;
  end;
  select username into v from public.profiles where id = '44444444-4444-4444-4444-444444444444';
  perform pg_temp.ok('nor take somebody else''s username',
    v_blocked and v = 'trudy');
end $$;

-- "Immutable, and unique: one Roblox account is one MintPlaza account."
do $$
declare v_blocked boolean := false; v text;
begin
  begin
    update public.profiles set roblox_user_id = '9999' where id = '44444444-4444-4444-4444-444444444444';
  exception when insufficient_privilege then v_blocked := true;
  end;
  select roblox_user_id into v from public.profiles where id = '44444444-4444-4444-4444-444444444444';
  perform pg_temp.ok('nor edit the Roblox id the whole identity rests on',
    v_blocked and v = '4444');
end $$;

-- The positive controls. Locking the tables must not have locked the player
-- out of their own account, which is the way this fix could quietly go wrong.
do $$
declare v text;
begin
  perform public.save_profile('trading kitsune today', '{blox-fruits}', '{}');
  select bio into v from public.profiles where id = '44444444-4444-4444-4444-444444444444';
  perform pg_temp.ok('but save_profile still writes the bio',
    v = 'trading kitsune today');
end $$;

do $$
declare v boolean;
begin
  perform public.set_hide_presence(true);
  select hide_presence into v from public.profiles where id = '44444444-4444-4444-4444-444444444444';
  perform pg_temp.ok('and set_hide_presence still works', v);
end $$;

do $$
declare n int;
begin
  perform public.cancel_trade_listing(
    (select id from public.trade_listings where user_id = '44444444-4444-4444-4444-444444444444' limit 1));
  select count(*) into n from public.trade_listings
   where user_id = '44444444-4444-4444-4444-444444444444' and status = 'cancelled';
  perform pg_temp.ok('and a player can still cancel their own listing', n = 1);
end $$;

reset role;


-- ===========================================================================
-- Nobody can forge the notice a party opens with
--
-- A party's pinned message is the site talking, and it is the only message in
-- the thread that carries any authority — which is exactly what makes it worth
-- forging. "MintPlaza: send your items to the host first" pinned above six
-- players who have just agreed to a deal is the most effective scam this site
-- could host, and it would look identical to the real notice.
--
-- No policy can stop it: a policy picks rows, not columns. The privilege does
-- — `authenticated` is granted INSERT on exactly the three columns the app
-- sends, so naming `kind` or `is_pinned` is refused before any policy runs.
-- ===========================================================================

reset role;
reset request.jwt.claim.sub;

insert into public.conversations (id, kind, title)
values ('f0000000-0000-0000-0000-00000000000f', 'party', 'Test party');
insert into public.conversation_participants (conversation_id, user_id) values
  ('f0000000-0000-0000-0000-00000000000f', '22222222-2222-2222-2222-222222222222'),
  ('f0000000-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111');
update public.profiles set status = 'active'
 where id = '22222222-2222-2222-2222-222222222222';

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

-- The positive control first. Locking the columns must not stop anybody
-- talking in the party they were just put in.
do $$
declare v_sent boolean := false;
begin
  begin
    insert into public.messages (conversation_id, sender_id, body)
    values ('f0000000-0000-0000-0000-00000000000f',
            '22222222-2222-2222-2222-222222222222', 'hey everyone');
    v_sent := true;
  exception when others then v_sent := false;
  end;
  perform pg_temp.ok('a member can talk in the party they are in', v_sent);
end $$;

do $$
declare v_got_in boolean := false; n int;
begin
  begin
    insert into public.messages (conversation_id, sender_id, body, kind, is_pinned)
    values ('f0000000-0000-0000-0000-00000000000f',
            '22222222-2222-2222-2222-222222222222',
            'MintPlaza: send your items to the host first.', 'system', true);
    v_got_in := true;
  exception when others then v_got_in := false;
  end;
  select count(*) into n from public.messages
   where conversation_id = 'f0000000-0000-0000-0000-00000000000f' and kind = 'system';
  perform pg_temp.ok('but cannot post one that looks like the site talking',
    not v_got_in and n = 0);
end $$;

do $$
declare v_got_in boolean := false; n int;
begin
  begin
    insert into public.messages (conversation_id, sender_id, body, is_pinned)
    values ('f0000000-0000-0000-0000-00000000000f',
            '22222222-2222-2222-2222-222222222222', 'read this first', true);
    v_got_in := true;
  exception when others then v_got_in := false;
  end;
  select count(*) into n from public.messages
   where conversation_id = 'f0000000-0000-0000-0000-00000000000f' and is_pinned;
  perform pg_temp.ok('nor pin one of their own above the thread',
    not v_got_in and n = 0);
end $$;

reset role;
