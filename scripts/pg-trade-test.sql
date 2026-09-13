-- The trading path, exercised against a real Postgres.
--
-- Assertion-driven on purpose: every check raises on failure rather than
-- printing a table for somebody to read, so a regression stops the run instead
-- of scrolling past. Run through scripts/pg-proof.sh, which builds the
-- throwaway database this expects.
\set ON_ERROR_STOP on

create or replace function pg_temp.ok(label text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'PASS  %', label;
  else raise exception 'FAIL  %', label;
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
