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
  for i in 1..4 loop
    perform public.post_trade_listing('blox-fruits',
      '[{"itemId":"bf-rocket"}]'::jsonb, '[]'::jsonb, null);
  end loop;
  perform pg_temp.ok('the three-per-window limit bites', false);
exception when sqlstate 'P0001' then
  perform pg_temp.ok('the three-per-window limit bites', true);
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

-- A blocked player disappears from the board in both directions.
do $$
declare n int;
begin
  insert into public.blocks (blocker_id, blocked_id)
  values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');

  select count(*) into n from public.trade_match_candidates('blox-fruits', 200);
  perform pg_temp.ok('a blocked player is not suggested', n = 0);

  select count(*) into n from public.trade_feed('blox-fruits', 30, null);
  perform pg_temp.ok('a blocked player is off the board', n = 0);

  delete from public.blocks;
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

set "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';

do $$
declare r record; v jsonb;
begin
  -- ---- free, before anything is granted ---------------------------------
  perform pg_temp.ok('a new player is not on Level Up',
    mintplaza.is_level_up('33333333-3333-3333-3333-333333333333') = false);

  select * into r from public.listing_allowance('blox-fruits');
  perform pg_temp.ok('and gets the free three slots', r.remaining = 3);
  perform pg_temp.ok('and the free ten-per-game cap', r.active_cap = 10);

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
  perform pg_temp.ok('the per-window allowance rises to eight', r.remaining = 8);
  perform pg_temp.ok('and the per-game cap to twenty-five', r.active_cap = 25);

  v := public.my_level_up();
  perform pg_temp.ok('my_level_up reports it active', (v->>'active')::boolean = true);
  perform pg_temp.ok('and counts the days left', (v->>'days_left')::int between 59 and 60);
end $$;

-- ---- the trigger honours it, not just the read function -------------------
--
-- listing_allowance only reports. This posts a fourth listing, which the free
-- tier refuses outright, and proves the enforcement path agrees with what the
-- screen was told.
do $$
declare i int; v_posted boolean := false;
begin
  begin
    for i in 1..4 loop
      perform public.post_trade_listing('blox-fruits',
        '[{"itemId":"bf-rocket"}]'::jsonb, '[]'::jsonb, null);
    end loop;
    v_posted := true;
  exception when sqlstate 'P0001' then
    v_posted := false;
  end;
  perform pg_temp.ok('a Level Up player can post past the free three-per-window limit', v_posted);
end $$;

-- ---- and still stops at the paid limit ------------------------------------
do $$
declare i int; v_stopped boolean := false;
begin
  begin
    for i in 1..5 loop
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
  perform pg_temp.ok('a Level Up listing lives 21 days, not 7',
    v_life between interval '20 days' and interval '22 days');
end $$;

-- ---- bumps come round three times a day -----------------------------------
do $$
declare v_listing uuid; v_when timestamptz;
begin
  select id into v_listing from public.trade_listings
   where user_id = '33333333-3333-3333-3333-333333333333'
   order by created_at desc limit 1;

  -- Nine hours ago is past the 8-hour Level Up cooldown and well inside the
  -- 24-hour free one, so this single call separates the two tiers exactly.
  update public.trade_listings set bumped_at = now() - interval '9 hours'
   where id = v_listing;

  v_when := public.bump_listing(v_listing);
  perform pg_temp.ok('Level Up bumps every 8 hours, not every 24', v_when is not null);
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
  perform pg_temp.ok('and the caps drop straight back to free', r.active_cap = 10);

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
