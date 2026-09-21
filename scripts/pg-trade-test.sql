-- The trading path, exercised against a real Postgres.
--
-- Assertion-driven on purpose: every check raises on failure rather than
-- printing a table for somebody to read, so a regression stops the run instead
-- of scrolling past. Run through scripts/pg-proof.sh, which builds the
-- throwaway database this expects.
\set ON_ERROR_STOP on

-- A failure raises with a SQLSTATE of its own, and that detail is load-bearing.
--
-- `raise exception 'FAIL %'` defaults to P0001 — which is exactly the code this
-- schema raises when a listing limit bites. Several tests below are shaped
-- "do the forbidden thing, expect P0001", and with the default code those
-- handlers caught their OWN failure report and turned it into a pass. Three
-- checks in this file were unfalsifiable because of it, proven by granting the
-- permission they test for and watching them still pass.
--
-- TF001 is not a code anything else raises, so a FAIL can never be mistaken for
-- the condition under test.
create or replace function pg_temp.ok(label text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'PASS  %', label;
  else raise exception 'FAIL  %', label using errcode = 'TF001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Two players and a game
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@x.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@x.test');

update public.profiles set username = 'alice', last_seen_at = now()
 where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set username = 'bob', last_seen_at = now()
 where id = '22222222-2222-2222-2222-222222222222';

insert into public.games (slug, name, short_name, is_active)
values ('blox-fruits', 'Blox Fruits', 'Blox Fruits', true)
on conflict (slug) do nothing;

-- Both have agreed to the rules, because posting and messaging now require it.
-- That requirement is tested on its own further down, with an account that has
-- not.
insert into public.terms_acceptance (user_id, version) values
  ('11111111-1111-1111-1111-111111111111', '2026-09-18'),
  ('22222222-2222-2222-2222-222222222222', '2026-09-18');

\echo ''
\echo 'KEYING'
do $$
declare t text; l text;
begin
  select data_type into t from information_schema.columns
   where table_schema='public' and table_name='inventory_entries' and column_name='item_id';
  select data_type into l from information_schema.columns
   where table_schema='public' and table_name='listing_sides' and column_name='item_id';
  perform pg_temp.ok('inventory item_id is text, not uuid', t = 'text');
  perform pg_temp.ok('listing side item_id is text, not uuid', l = 'text');
end $$;

-- ---------------------------------------------------------------------------
-- Inventory: the writes that used to come back 22P02, every time
-- ---------------------------------------------------------------------------
\echo ''
\echo 'INVENTORY'
set "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

insert into public.inventory_entries (user_id, game_slug, item_id, kind, quantity, attributes) values
  ('11111111-1111-1111-1111-111111111111','blox-fruits','bf-kitsune','have',1,'{}'),
  ('11111111-1111-1111-1111-111111111111','blox-fruits','bf-magnet','want',1,'{}');

do $$
declare n int;
begin
  select count(*) into n from public.inventory_entries;
  perform pg_temp.ok('a catalogue slug saves as an item_id', n = 2);
end $$;

do $$ begin
  insert into public.inventory_entries (user_id, game_slug, item_id, kind, quantity)
  values ('11111111-1111-1111-1111-111111111111','blox-fruits','bf-kitsune','have',1);
  perform pg_temp.ok('a duplicate holding is rejected', false);
exception when unique_violation then
  perform pg_temp.ok('a duplicate holding is rejected', true);
end $$;

-- The same item in a different variant is a different holding, and the index
-- must not treat it as a repeat.
do $$ begin
  insert into public.inventory_entries (user_id, game_slug, item_id, kind, quantity, attributes)
  values ('11111111-1111-1111-1111-111111111111','blox-fruits','bf-kitsune','have',1,
          '{"variant":"Permanent"}');
  perform pg_temp.ok('the same item in another variant is still addable', true);
exception when unique_violation then
  perform pg_temp.ok('the same item in another variant is still addable', false);
end $$;

do $$ begin
  insert into public.inventory_entries (user_id, game_slug, item_id, kind)
  values ('11111111-1111-1111-1111-111111111111','blox-fruits',
          '33333333-3333-3333-3333-333333333333','have');
  perform pg_temp.ok('a uuid in item_id is rejected', false);
exception when check_violation then
  perform pg_temp.ok('a uuid in item_id is rejected', true);
end $$;

-- ---------------------------------------------------------------------------
-- Posting
-- ---------------------------------------------------------------------------
\echo ''
\echo 'POSTING'
set "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

select public.post_trade_listing(
  'blox-fruits',
  '[{"itemId":"bf-magnet","quantity":1}]'::jsonb,
  '[{"itemId":"bf-kitsune","quantity":1,"attributes":{"variant":"Permanent"}}]'::jsonb,
  'in-game only') as listing_id \gset

do $$
declare n int; v text;
begin
  select count(*) into n from public.listing_sides;
  perform pg_temp.ok('both sides are written in one call', n = 2);

  select attributes->>'variant' into v from public.listing_sides where side = 'want';
  perform pg_temp.ok('a variant survives the round trip', v = 'Permanent');
end $$;

do $$ begin
  perform public.post_trade_listing('blox-fruits', '[]'::jsonb, '[]'::jsonb, null);
  perform pg_temp.ok('a listing offering nothing is refused', false);
exception when sqlstate 'P0001' then
  perform pg_temp.ok('a listing offering nothing is refused', true);
end $$;

do $$
declare i int;
begin
  for i in 1..5 loop
    perform public.post_trade_listing('blox-fruits',
      '[{"itemId":"bf-rocket"}]'::jsonb, '[]'::jsonb, null);
  end loop;
  perform pg_temp.ok('the four-per-window limit bites', false);
exception when sqlstate 'P0001' then
  perform pg_temp.ok('the four-per-window limit bites', true);
end $$;

do $$
declare r record;
begin
  select * into r from public.listing_allowance('blox-fruits');
  -- The four attempts above rolled back with their block, so only the first
  -- listing stands. A rolled-back attempt must not consume a slot.
  perform pg_temp.ok('the allowance counts what was actually posted', r.used = 1);
end $$;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------
\echo ''
\echo 'READING'
set "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

do $$
declare n int; s jsonb;
begin
  select count(*) into n from public.trade_match_candidates('blox-fruits', 200);
  perform pg_temp.ok('the prefilter finds a listing that touches my lists', n = 1);

  select sides into s from public.trade_match_candidates('blox-fruits', 200) limit 1;
  -- These are the exact keys toBoardListing() reads. A rename on either side
  -- silently empties every listing on the board, which renders as a card with
  -- no items rather than as an error.
  perform pg_temp.ok('sides carry the keys the matcher reads',
    s->0 ? 'side' and s->0 ? 'itemId' and s->0 ? 'quantity' and s->0 ? 'attributes');

  select count(*) into n from public.trade_feed('blox-fruits', 30, null);
  perform pg_temp.ok('the public board shows it', n = 1);

  select count(*) into n from public.my_trade_listings('blox-fruits');
  perform pg_temp.ok('it is not mine', n = 0);

  select count(*) into n
    from public.trade_listings_of('22222222-2222-2222-2222-222222222222','blox-fruits');
  perform pg_temp.ok('it is on its owner''s profile', n = 1);
end $$;

-- There is no blocking on this site, on purpose: a scammer's last move is to
-- block the person they just took an item from, which buries the conversation
-- and leaves the victim nothing to point at. So the board hides nobody, and the
-- lever is suspension instead — checked further down under MESSAGING.
do $$
declare n int;
begin
  perform pg_temp.ok('there is no blocks table to hide anybody with',
    to_regclass('public.blocks') is null);

  select count(*) into n from public.trade_feed('blox-fruits', 30, null);
  perform pg_temp.ok('and every live listing is on the board', n = 1);
end $$;

-- Status is the intent; the clock is the truth. expire_listings() is a
-- scheduled job, and a job that has not run must not leave a stale listing in
-- front of somebody.
do $$
declare n int;
begin
  update public.trade_listings set expires_at = now() - interval '1 minute';
  select count(*) into n from public.trade_feed('blox-fruits', 30, null);
  perform pg_temp.ok('an expired listing leaves the board even while status says active', n = 0);

  select count(*) into n from public.trade_match_candidates('blox-fruits', 200);
  perform pg_temp.ok('and it is not suggested either', n = 0);
end $$;

-- ---------------------------------------------------------------------------
-- Level Up
--
-- The whole reason the entitlement lives in the database rather than in the
-- app: every perk is a limit a trigger already enforces, so these checks are
-- against the trigger itself. If any of them can be made to pass by editing a
-- page in a browser, the design is wrong.
-- ---------------------------------------------------------------------------
\echo ''
\echo 'LEVEL UP'

-- A clean player, so the earlier tests' listings do not count against them.
insert into auth.users (id, email)
values ('33333333-3333-3333-3333-333333333333', 'c@x.test');
update public.profiles set username = 'carol', last_seen_at = now()
 where id = '33333333-3333-3333-3333-333333333333';
insert into public.terms_acceptance (user_id, version)
values ('33333333-3333-3333-3333-333333333333', '2026-09-18');

set "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';

do $$
declare r record; v jsonb;
begin
  -- ---- free, before anything is granted ---------------------------------
  perform pg_temp.ok('a new player is not on Level Up',
    mintplaza.is_level_up('33333333-3333-3333-3333-333333333333') = false);

  select * into r from public.listing_allowance('blox-fruits');
  perform pg_temp.ok('and gets the free four slots', r.remaining = 4);
  perform pg_temp.ok('and the free four-per-game cap', r.active_cap = 4);
  perform pg_temp.ok('on the free 24-hour window', r.window_hours = 24);

  v := public.my_level_up();
  perform pg_temp.ok('my_level_up says not active', (v->>'active')::boolean = false);
  perform pg_temp.ok('and distinguishes never-had-it from lapsed',
    (v->>'lapsed') is null or (v->>'lapsed')::boolean = false);
end $$;

-- ---- a player cannot grant it to themselves -------------------------------
--
-- The most important check in this file. There is no insert policy on
-- entitlements at all, so this must fail for a signed-in player no matter what
-- they send. Run as a non-superuser, because a superuser bypasses RLS and
-- would make this pass for the wrong reason.
do $$
declare v_got_in boolean := false; v_rows int;
begin
  -- The attempt goes in its own block and records only whether it worked.
  -- ok() is called afterwards, outside every handler, so a failing assertion
  -- cannot be swallowed by the handler that is here to catch the insert.
  begin
    set local role authenticated;
    insert into public.entitlements (user_id, expires_at)
    values ('33333333-3333-3333-3333-333333333333', now() + interval '10 years');
    v_got_in := true;
  exception when others then
    v_got_in := false;
  end;
  reset role;

  -- Belt and braces: an insert that somehow succeeded without raising still
  -- leaves a row, and the row is the thing that would actually grant the perk.
  select count(*) into v_rows from public.entitlements
   where user_id = '33333333-3333-3333-3333-333333333333';

  perform pg_temp.ok('a player cannot grant themselves Level Up',
    v_got_in = false and v_rows = 0);
end $$;

-- ---- and cannot extend one they already have ------------------------------
insert into public.entitlements (user_id, expires_at, source, country)
values ('33333333-3333-3333-3333-333333333333', now() + interval '60 days', 'purchase', 'IN');

do $$
declare v_until timestamptz;
begin
  begin
    set local role authenticated;
    update public.entitlements set expires_at = now() + interval '10 years'
     where user_id = '33333333-3333-3333-3333-333333333333';
  exception when others then
    null;  -- Refused outright is a pass; so is matching zero rows. The date below decides.
  end;
  reset role;

  -- With no update policy RLS matches zero rows rather than raising, so the
  -- only honest check is the value itself: did the date move?
  select expires_at into v_until from public.entitlements
   where user_id = '33333333-3333-3333-3333-333333333333';
  perform pg_temp.ok('a player cannot extend their own Level Up',
    v_until < now() + interval '61 days');
end $$;

do $$
declare r record; v jsonb;
begin
  -- ---- the perks are real ------------------------------------------------
  perform pg_temp.ok('now they are on Level Up',
    mintplaza.is_level_up('33333333-3333-3333-3333-333333333333') = true);

  select * into r from public.listing_allowance('blox-fruits');
  perform pg_temp.ok('the per-window allowance rises to ten', r.remaining = 10);
  perform pg_temp.ok('and the per-game cap to ten', r.active_cap = 10);
  -- The window is the other half of the rate limit and a perk in its own
  -- right. Ten per 24 hours would be ten a day; ten per 12 is twenty, which is
  -- the number the upgrade page sells.
  perform pg_temp.ok('and the window halves to twelve hours', r.window_hours = 12);

  v := public.my_level_up();
  perform pg_temp.ok('my_level_up reports it active', (v->>'active')::boolean = true);
  perform pg_temp.ok('and counts the days left', (v->>'days_left')::int between 59 and 60);
end $$;

-- ---- the trigger honours it, not just the read function -------------------
--
-- listing_allowance only reports. This posts a fifth listing, which the free
-- tier refuses outright, and proves the enforcement path agrees with what the
-- screen was told.
do $$
declare i int; v_posted boolean := false;
begin
  begin
    for i in 1..5 loop
      perform public.post_trade_listing('blox-fruits',
        '[{"itemId":"bf-rocket"}]'::jsonb, '[]'::jsonb, null);
    end loop;
    v_posted := true;
  exception when sqlstate 'P0001' then
    v_posted := false;
  end;
  perform pg_temp.ok('a Level Up player can post past the free four-listing limit', v_posted);
end $$;

-- ---- and still stops at the paid limit ------------------------------------
do $$
declare i int; v_stopped boolean := false;
begin
  begin
    for i in 1..10 loop
      perform public.post_trade_listing('blox-fruits',
        '[{"itemId":"bf-rocket"}]'::jsonb, '[]'::jsonb, null);
    end loop;
  exception when sqlstate 'P0001' then
    v_stopped := true;
  end;
  perform pg_temp.ok('but Level Up is a bigger limit, not no limit', v_stopped);
end $$;

-- ---- listings live longer ------------------------------------------------
do $$
declare v_life interval;
begin
  select expires_at - created_at into v_life
    from public.trade_listings
   where user_id = '33333333-3333-3333-3333-333333333333'
   order by created_at desc limit 1;
  perform pg_temp.ok('a Level Up listing lives 3 days, not 24 hours',
    v_life between interval '2 days 23 hours' and interval '3 days 1 hour');
end $$;

-- ---- bumping, which is NOT a Level Up perk -------------------------------
--
-- Deliberately the same for everyone. The board sorts on bumped_at, so a paid
-- bump is the one perk that takes something from every other player: it pushes
-- their listings down. Six hours also had to replace the old 24, because a free
-- listing now expires at 24 hours — under the old cooldown it died at the exact
-- moment it first became bumpable, so the feature did nothing for anybody who
-- had not paid.
do $$
declare v_listing uuid; v_when timestamptz;
begin
  select id into v_listing from public.trade_listings
   where user_id = '33333333-3333-3333-3333-333333333333'
   order by created_at desc limit 1;

  update public.trade_listings set bumped_at = now() - interval '7 hours'
   where id = v_listing;

  v_when := public.bump_listing(v_listing);
  perform pg_temp.ok('a listing can be bumped once every six hours', v_when is not null);

  perform pg_temp.ok('and the cooldown is the same whether or not you pay',
    mintplaza.bumps_per_day_for('33333333-3333-3333-3333-333333333333')
      = mintplaza.bumps_per_day_for('22222222-2222-2222-2222-222222222222'));
end $$;

do $$
declare v_listing uuid; v_refused boolean := false;
begin
  select id into v_listing from public.trade_listings
   where user_id = '33333333-3333-3333-3333-333333333333'
   order by created_at desc limit 1;
  begin
    -- Straight after a bump, even a paying player waits.
    perform public.bump_listing(v_listing);
  exception when sqlstate 'P0001' then
    v_refused := true;
  end;
  perform pg_temp.ok('and not twice in a row', v_refused);
end $$;

-- ---- expiry demotes without anything having to run ------------------------
--
-- No cron job, no sweep, no "downgrade expired subscriptions" task that can
-- fail silently at 3am. The limit reads the date, so the moment it passes the
-- player is back on the free tier.
do $$
declare r record; v jsonb;
begin
  update public.entitlements set expires_at = now() - interval '1 second'
   where user_id = '33333333-3333-3333-3333-333333333333';

  perform pg_temp.ok('an expired subscription stops counting, with nothing scheduled',
    mintplaza.is_level_up('33333333-3333-3333-3333-333333333333') = false);

  select * into r from public.listing_allowance('blox-fruits');
  perform pg_temp.ok('and the caps drop straight back to free', r.active_cap = 4);
  perform pg_temp.ok('including the window, which goes back to a day', r.window_hours = 24);

  v := public.my_level_up();
  perform pg_temp.ok('and the player is told it lapsed rather than never existed',
    (v->>'active')::boolean = false and (v->>'lapsed')::boolean = true);
end $$;

-- ---- a refund stops it even before the date --------------------------------
do $$ begin
  update public.entitlements
     set expires_at = now() + interval '60 days', source = 'refunded'
   where user_id = '33333333-3333-3333-3333-333333333333';
  perform pg_temp.ok('a refunded subscription does not work even inside its dates',
    mintplaza.is_level_up('33333333-3333-3333-3333-333333333333') = false);
end $$;

-- ---- one webhook delivered twice grants 60 days, not 120 -------------------
--
-- The unique index on payment_ref is the whole defence. Proven here against the
-- table directly, because admin_grant_level_up needs an allowlisted owner that
-- this test database has no way to be.
do $$
declare v_blocked boolean := false;
begin
  delete from public.entitlements where user_id = '33333333-3333-3333-3333-333333333333';
  insert into public.entitlements (user_id, expires_at, payment_ref)
  values ('33333333-3333-3333-3333-333333333333', now() + interval '60 days', 'pay_abc123');
  begin
    insert into public.entitlements (user_id, expires_at, payment_ref)
    values ('22222222-2222-2222-2222-222222222222', now() + interval '60 days', 'pay_abc123');
  exception when unique_violation then
    v_blocked := true;
  end;
  perform pg_temp.ok('the same payment cannot be applied twice', v_blocked);
end $$;

-- ---- granting is admin-only ------------------------------------------------
do $$
declare v_refused boolean := false;
begin
  begin
    perform public.admin_grant_level_up('carol', 60, 'IN');
  exception when others then
    v_refused := true;
  end;
  perform pg_temp.ok('granting Level Up needs the owner''s allowlist', v_refused);
end $$;

-- ---------------------------------------------------------------------------
-- Messaging
--
-- The tables and policies for this existed from the first version of the
-- schema and were unusable: there is no INSERT policy on conversations or
-- conversation_participants, so every player could read a thread they were in
-- and none of them could ever be in one. start_conversation() is the only way
-- a row appears, and these are the checks that say so.
-- ---------------------------------------------------------------------------
\echo ''
\echo 'MESSAGING'

set "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

do $$
declare v_id uuid; v_again uuid; t jsonb;
begin
  v_id := public.start_conversation('bob');
  perform pg_temp.ok('alice can open a conversation with bob', v_id is not null);

  -- The single most important property of this function. Tapping Message
  -- twice, or from two different listings, must land in the SAME thread — or
  -- the inbox fills with duplicates each holding half the history.
  v_again := public.start_conversation('bob');
  perform pg_temp.ok('opening it again returns the same thread, not a second one',
    v_again = v_id);

  -- And from a listing, which passes an id but must still reuse the thread.
  v_again := public.start_conversation('bob',
    (select id from public.trade_listings limit 1));
  perform pg_temp.ok('and so does opening it from a listing', v_again = v_id);

  perform pg_temp.ok('both people are in it',
    (select count(*) from public.conversation_participants
      where conversation_id = v_id) = 2);
end $$;

do $$
declare v_refused boolean := false;
begin
  begin perform public.start_conversation('alice');
  exception when sqlstate 'P0001' then v_refused := true; end;
  perform pg_temp.ok('you cannot message yourself', v_refused);
end $$;

do $$
declare v_refused boolean := false;
begin
  begin perform public.start_conversation('nobody-by-that-name');
  exception when sqlstate 'P0001' then v_refused := true; end;
  perform pg_temp.ok('nor somebody who does not exist', v_refused);
end $$;

-- ---- sending, reading, and the unread count -------------------------------
do $$
declare v_id uuid; t jsonb; n int;
begin
  select conversation_id into v_id from public.conversation_participants
   where user_id = '11111111-1111-1111-1111-111111111111' limit 1;

  insert into public.messages (conversation_id, sender_id, body)
  values (v_id, '11111111-1111-1111-1111-111111111111', 'wtt kitsune for magnet');

  t := public.conversation_thread(v_id);
  perform pg_temp.ok('the message is in the thread',
    jsonb_array_length(t->'messages') = 1);
  perform pg_temp.ok('and it knows the message is mine',
    (t->'messages'->0->>'mine')::boolean = true);
  perform pg_temp.ok('and the thread names the other person',
    t->'other'->>'username' = 'bob');

  -- Sending must move the inbox, or every new message sorts to the bottom.
  perform pg_temp.ok('sending moved the conversation to the top of the inbox',
    (select last_message_at from public.conversations where id = v_id)
      > now() - interval '5 seconds');
end $$;

-- Bob's side: the unread count, then reading it.
set "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
do $$
declare v_id uuid; c jsonb;
begin
  perform pg_temp.ok('bob has one unread conversation', public.unread_count() = 1);

  c := public.my_conversations();
  perform pg_temp.ok('and it is in his inbox', jsonb_array_length(c) = 1);
  perform pg_temp.ok('with alice named on it', c->0->>'other_username' = 'alice');
  perform pg_temp.ok('and the last thing said', c->0->>'last_body' = 'wtt kitsune for magnet');
  perform pg_temp.ok('and it is marked as not from him',
    (c->0->>'last_sender_is_me')::boolean = false);
  perform pg_temp.ok('and counted unread', (c->0->>'unread')::int = 1);

  select conversation_id into v_id from public.conversation_participants
   where user_id = '22222222-2222-2222-2222-222222222222' limit 1;
  perform public.mark_conversation_read(v_id);
  perform pg_temp.ok('reading it clears the count', public.unread_count() = 0);
end $$;

-- ---- THE ATTACK THIS DESIGN EXISTS TO STOP --------------------------------
--
-- An insert policy saying "user_id = auth.uid()" on conversation_participants
-- would have been the obvious way to let somebody join a thread. It also lets
-- any signed-in player insert THEMSELVES into any existing conversation by id
-- and read two strangers' entire history, because the read policy would then
-- honestly report them as a participant.
--
-- There is no insert policy, so this must fail. Run as `authenticated`,
-- because a superuser bypasses RLS and would pass for the wrong reason.
--
-- The attacker must insert THEMSELVES, and must be signed in AS themselves.
-- An earlier version of this test had bob inserting carol's id, which the
-- obvious bad policy ("user_id = auth.uid()") refuses anyway — so the test
-- passed even with that policy installed and proved nothing. Found by adding
-- the policy on purpose and watching the test not notice.
set "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
do $$
declare v_id uuid; v_got_in boolean := false; n int;
begin
  -- Alice and bob's thread. Carol is in no thread with anybody.
  select p.conversation_id into v_id
    from public.conversation_participants p
   where p.user_id = '11111111-1111-1111-1111-111111111111'
     and exists (select 1 from public.conversation_participants q
                  where q.conversation_id = p.conversation_id
                    and q.user_id = '22222222-2222-2222-2222-222222222222')
   limit 1;

  begin
    set local role authenticated;
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_id, '33333333-3333-3333-3333-333333333333');
    v_got_in := true;
  exception when others then v_got_in := false;
  end;
  reset role;

  select count(*) into n from public.conversation_participants
   where conversation_id = v_id
     and user_id = '33333333-3333-3333-3333-333333333333';
  perform pg_temp.ok('a stranger cannot join themselves to somebody else''s thread',
    not v_got_in and n = 0);
end $$;

-- Nor conjure a conversation to attach themselves to.
do $$
declare v_got_in boolean := false; n int;
begin
  select count(*) into n from public.conversations;
  begin
    set local role authenticated;
    insert into public.conversations (id) values (gen_random_uuid());
    v_got_in := true;
  exception when others then v_got_in := false;
  end;
  reset role;
  perform pg_temp.ok('nor create a conversation row directly',
    not v_got_in and (select count(*) from public.conversations) = n);
end $$;

-- And conversation_thread() is SECURITY DEFINER, so its own participant check
-- IS the access control. Carol is in no thread with anybody.
do $$
declare v_id uuid; v_refused boolean := false;
begin
  select conversation_id into v_id from public.conversation_participants
   where user_id = '11111111-1111-1111-1111-111111111111' limit 1;
  begin perform public.conversation_thread(v_id);
  exception when sqlstate 'P0001' then v_refused := true; end;
  perform pg_temp.ok('a stranger cannot read a thread by its id', v_refused);

  perform pg_temp.ok('and sees nothing in their own inbox',
    jsonb_array_length(public.my_conversations()) = 0);
end $$;

-- ---- suspension, which is what replaces blocking -------------------------
--
-- With no blocking, this is the ONLY thing that stops somebody behaving badly
-- — and it is the better shape. A block protects the one person who pressed
-- it; a suspension protects everybody the account has not reached yet.
--
-- Only the function-level half is checked here. The other half is the RLS
-- policy on messages, and this file runs as SUPERUSER, which bypasses RLS
-- entirely — so a send test here would pass whether the policy works or not.
-- An earlier version of this block tried it anyway with `set local role
-- authenticated`, and it "passed" because this database never grants that role
-- table privileges, so the insert failed on permissions rather than on
-- suspension. It is in pg-rls-test.sql now, where the grants are real.
set "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

do $$
declare v_opened boolean := false;
begin
  update public.profiles set status = 'suspended'
   where id = '11111111-1111-1111-1111-111111111111';

  begin
    perform public.start_conversation('bob');
    v_opened := true;
  exception when sqlstate 'P0001' then v_opened := false;
  end;
  perform pg_temp.ok('a suspended account cannot open a conversation with anybody',
    not v_opened);

  -- Lifting it has to work, or a mistaken suspension would be permanent.
  update public.profiles set status = 'active'
   where id = '11111111-1111-1111-1111-111111111111';

  begin
    perform public.start_conversation('bob');
    v_opened := true;
  exception when sqlstate 'P0001' then v_opened := false;
  end;
  perform pg_temp.ok('and lifting it lets them start one again', v_opened);
end $$;
set "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

-- ---- rate limits ----------------------------------------------------------
set "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
do $$
declare v_id uuid; i int; v_stopped boolean := false;
begin
  select conversation_id into v_id from public.conversation_participants
   where user_id = '22222222-2222-2222-2222-222222222222' limit 1;

  begin
    for i in 1..(mintplaza.messages_per_minute() + 2) loop
      insert into public.messages (conversation_id, sender_id, body)
      values (v_id, '22222222-2222-2222-2222-222222222222', 'spam ' || i);
    end loop;
  exception when sqlstate 'P0001' then v_stopped := true;
  end;
  perform pg_temp.ok('a burst of messages is stopped', v_stopped);
end $$;

-- The client does not get to set the clock. A message that arrived with its
-- own created_at could sit outside its rate window forever.
do $$
declare v_id uuid; v_when timestamptz;
begin
  select conversation_id into v_id from public.conversation_participants
   where user_id = '22222222-2222-2222-2222-222222222222' limit 1;
  delete from public.messages
   where sender_id = '22222222-2222-2222-2222-222222222222';

  insert into public.messages (conversation_id, sender_id, body, created_at, status)
  values (v_id, '22222222-2222-2222-2222-222222222222', 'from the future',
          now() + interval '100 years', 'hidden')
  returning created_at into v_when;

  perform pg_temp.ok('the server owns the message clock',
    v_when < now() + interval '1 minute');
  perform pg_temp.ok('and the message status',
    (select status from public.messages
      where sender_id = '22222222-2222-2222-2222-222222222222'
      order by created_at desc limit 1) = 'visible');
end $$;

-- ---- the new-thread limit -------------------------------------------------
do $$
declare i int; v_stopped boolean := false; v_name text;
begin
  -- Enough strangers to walk past the daily cap.
  for i in 1..(mintplaza.new_threads_per_day() + 2) loop
    v_name := 'spamtarget' || i;
    insert into auth.users (id, email)
    values (gen_random_uuid(), v_name || '@x.test');
    update public.profiles set username = v_name, last_seen_at = now()
     where id = (select id from auth.users where email = v_name || '@x.test');
  end loop;

  begin
    for i in 1..(mintplaza.new_threads_per_day() + 2) loop
      perform public.start_conversation('spamtarget' || i);
    end loop;
  exception when sqlstate 'P0001' then v_stopped := true;
  end;
  perform pg_temp.ok('opening threads with a whole game at once is stopped', v_stopped);
end $$;


-- ---------------------------------------------------------------------------
-- Agreeing to the rules is not optional
--
-- The consent screen covers /app. It is a screen, and /messages is its own
-- route — a determined account could sign in and go straight there without
-- passing through it, which is exactly what somebody would do in order to say
-- afterwards that they never agreed not to scam anybody.
--
-- So it is enforced in the database as well, where navigating around it is not
-- a thing that exists. The check is version-agnostic on purpose: the database
-- asks "have you ever agreed", the application asks "to the current version".
-- ---------------------------------------------------------------------------
\echo ''
\echo 'AGREEING TO THE RULES'

insert into auth.users (id, email)
values ('44444444-4444-4444-4444-444444444444', 'dave@x.test');
update public.profiles set username = 'dave', last_seen_at = now()
 where id = '44444444-4444-4444-4444-444444444444';

set "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';

do $$
declare v_did boolean := false;
begin
  perform pg_temp.ok('a brand new account has agreed to nothing',
    mintplaza.has_agreed('44444444-4444-4444-4444-444444444444') = false);

  -- Posting a listing.
  begin
    perform public.post_trade_listing('blox-fruits',
      '[{"itemId":"bf-rocket"}]'::jsonb, '[]'::jsonb, null);
    v_did := true;
  exception when sqlstate 'P0001' then v_did := false;
  end;
  perform pg_temp.ok('and cannot post a listing until it does', not v_did);

  -- Opening a conversation, which is the route around the consent screen.
  begin
    perform public.start_conversation('alice');
    v_did := true;
  exception when sqlstate 'P0001' then v_did := false;
  end;
  perform pg_temp.ok('nor open a conversation with anybody', not v_did);
end $$;

-- And once they agree, everything works.
do $$
declare v_did boolean := false;
begin
  perform public.accept_terms('2026-09-18');
  perform pg_temp.ok('agreeing is recorded',
    mintplaza.has_agreed('44444444-4444-4444-4444-444444444444') = true);

  begin
    perform public.post_trade_listing('blox-fruits',
      '[{"itemId":"bf-rocket"}]'::jsonb, '[]'::jsonb, null);
    v_did := true;
  exception when sqlstate 'P0001' then v_did := false;
  end;
  perform pg_temp.ok('and then they can post', v_did);

  begin
    perform public.start_conversation('alice');
    v_did := true;
  exception when sqlstate 'P0001' then v_did := false;
  end;
  perform pg_temp.ok('and message somebody', v_did);
end $$;

-- Agreeing to an OLD version still counts for the database floor. Somebody who
-- agreed last year is asked again by the application, not locked out by the
-- database — which is the right split, and the wrong one would lock every
-- existing player out of the site the moment the terms were edited.
do $$
declare v_did boolean := false;
begin
  delete from public.terms_acceptance
   where user_id = '44444444-4444-4444-4444-444444444444';
  insert into public.terms_acceptance (user_id, version, accepted_at)
  values ('44444444-4444-4444-4444-444444444444', '2020-01-01', now() - interval '3 years');

  perform pg_temp.ok('an old acceptance still lets somebody use the site',
    mintplaza.has_agreed('44444444-4444-4444-4444-444444444444') = true);
  perform pg_temp.ok('while the application still knows to re-ask them',
    public.has_accepted_terms('2026-09-18') = false);
end $$;


-- ===========================================================================
-- An expired listing does not keep holding a slot
--
-- 'active' and 'not yet expired' are two different facts, and only one of them
-- is kept up to date. expire_listings() is the job that turns an elapsed
-- listing into status='expired', and nothing in this codebase schedules it —
-- no cron, no call from the app. So a listing whose day is up stays 'active'
-- in the table indefinitely while being invisible everywhere a player looks,
-- because every read path filters on expires_at.
--
-- Every read path except the two that decide whether you may post again.
--
-- The effect on a free account was a permanent lockout of a whole game: four
-- listings in one game, and the next day the rolling window handed all four
-- posting slots back and the dashboard said "4 of 4 available", while the
-- per-game count still saw four expired rows and refused every post. Forever,
-- and worse the more the player used the site.
-- ===========================================================================

set "request.jwt.claim.sub" = '55555555-5555-5555-5555-555555555555';
insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'sweep@x.test');
update public.profiles set username = 'sweeper'
 where id = '55555555-5555-5555-5555-555555555555';
insert into public.terms_acceptance (user_id, version)
values ('55555555-5555-5555-5555-555555555555', '2026-09-18');

do $$
declare r record; i int;
begin
  for i in 1..4 loop
    perform public.post_trade_listing('blox-fruits',
      '[{"itemId":"bf-rocket"}]'::jsonb, '[]'::jsonb, null);
  end loop;
  select * into r from public.listing_allowance('blox-fruits');
  perform pg_temp.ok('four listings fill the free per-game cap',
    r.active_in_game = 4 and r.active_cap = 4);
end $$;

-- A day passes. The listings elapse; nothing sweeps them.
update public.trade_listings
   set expires_at = now() - interval '1 hour',
       created_at = now() - interval '48 hours'
 where user_id = '55555555-5555-5555-5555-555555555555';

do $$
declare r record;
begin
  select * into r from public.listing_allowance('blox-fruits');
  perform pg_temp.ok(
    'an elapsed listing stops counting against the per-game cap',
    r.active_in_game = 0);
  perform pg_temp.ok('and the rolling window has handed the slots back',
    r.remaining = 4);
end $$;

do $$
declare v_posted boolean := false;
begin
  begin
    perform public.post_trade_listing('blox-fruits',
      '[{"itemId":"bf-rocket"}]'::jsonb, '[]'::jsonb, null);
    v_posted := true;
  exception when others then v_posted := false;
  end;
  perform pg_temp.ok(
    'so the player is not locked out of the game they used yesterday',
    v_posted);
end $$;

-- The positive control. A count that simply stopped counting would pass every
-- assertion above and take the per-game cap off the site altogether.
do $$
declare v_stopped boolean := false; i int;
begin
  begin
    for i in 1..5 loop
      perform public.post_trade_listing('blox-fruits',
        '[{"itemId":"bf-rocket"}]'::jsonb, '[]'::jsonb, null);
    end loop;
  exception when sqlstate 'P0001' then v_stopped := true;
  end;
  perform pg_temp.ok('but listings that really are live still stop them',
    v_stopped);
end $$;
