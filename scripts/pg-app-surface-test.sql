-- Every function and table the application calls by name, exercised against a
-- real Postgres.
--
-- The trade test next door proves the trading path. This one exists because a
-- different class of bug got through it: the schema applied clean, every
-- trading assertion passed, and the app still could not run, because seventeen
-- of the twenty-nine functions it calls by name were never in the file and one
-- missing table threw on every sign-in. Applying cleanly is not the same as
-- being complete, and only calling what the app calls can tell the two apart.
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

-- ---------------------------------------------------------------------------
-- Every RPC the app calls must exist, callable, with the arity it calls.
-- ---------------------------------------------------------------------------
\echo ''
\echo 'RPC SURFACE'
do $$
declare
  wanted text[] := array[
    'add_proof','admin_add_media','admin_delete_media','admin_reorder_games',
    'admin_reports','admin_resolve_report','admin_save_game','admin_save_template',
    'admin_set_explore_tabs','admin_set_game_active','admin_set_template_active',
    'board_listings','bump_listing','cancel_trade_listing','console_lock',
    'console_phrase_matches','console_unlock','console_unlocked',
    'delete_my_account','delete_proof','ensure_profile','is_admin',
    'listing_allowance','post_trade_listing','public_profile','save_profile',
    'set_display_name','set_hide_presence','touch_presence'
  ];
  fn text;
  missing text[] := '{}';
begin
  foreach fn in array wanted loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = fn
    ) then missing := array_append(missing, fn);
    end if;
  end loop;
  perform pg_temp.ok(
    format('all %s RPCs the app calls exist%s', array_length(wanted,1),
           case when missing = '{}' then '' else ' (missing: ' || array_to_string(missing, ', ') || ')' end),
    missing = '{}');
end $$;

-- Tables the app reads through PostgREST.
do $$
declare t text; missing text[] := '{}';
begin
  foreach t in array array['games','game_items','inventory_entries','profiles',
                           'reports','media','service_templates','service_listings',
                           'service_votes','service_picks','service_comments'] loop
    if to_regclass('public.' || t) is null then missing := array_append(missing, t); end if;
  end loop;
  perform pg_temp.ok('every table the app selects from exists', missing = '{}');
end $$;

-- ---------------------------------------------------------------------------
-- Sign-in. The bug that broke everybody: ensure_profile() called a function
-- that referenced a table nothing created, and its only handler caught
-- unique_violation, so 42P01 went straight to the caller.
-- ---------------------------------------------------------------------------
\echo ''
\echo 'SIGN-IN'
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'owner@x.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'player@x.test');

update public.profiles set username = 'OwnerPerson' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
update public.profiles set username = 'SomePlayer'  where id = 'bbbbbbbb-0000-0000-0000-00000000000b';

set "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-00000000000a';
do $$ begin
  perform public.ensure_profile();
  perform pg_temp.ok('ensure_profile() survives a sign-in', true);
exception when others then
  perform pg_temp.ok('ensure_profile() survives a sign-in — ' || sqlerrm, false);
end $$;

do $$ begin
  perform pg_temp.ok('the allowlist ships empty, so nobody is admin yet',
    public.is_admin() = false);
end $$;

-- Binding: seed the username, sign in again, and the numeric id is pinned.
insert into mintplaza.admin_allowlist (roblox_username) values ('ownerperson');
do $$
declare v_bound text;
begin
  perform public.ensure_profile();
  select roblox_user_id into v_bound from mintplaza.admin_allowlist;
  perform pg_temp.ok('the first matching sign-in pins the roblox id', v_bound is not null);
  perform pg_temp.ok('and that account is now the admin', public.is_admin());
end $$;

set "request.jwt.claim.sub" = 'bbbbbbbb-0000-0000-0000-00000000000b';
do $$ begin
  perform public.ensure_profile();
  perform pg_temp.ok('a normal player is not an admin', public.is_admin() = false);
end $$;

-- A renamed impostor must not inherit the panel.
do $$
declare n int;
begin
  update public.profiles set username = 'OwnerPerson2'
   where id = 'bbbbbbbb-0000-0000-0000-00000000000b';
  perform public.ensure_profile();
  select count(*) into n from mintplaza.admin_allowlist where roblox_user_id = '2';
  perform pg_temp.ok('a second account cannot take a bound allowlist row', n = 0);
  perform pg_temp.ok('and it is still not an admin', public.is_admin() = false);
  update public.profiles set username = 'SomePlayer'
   where id = 'bbbbbbbb-0000-0000-0000-00000000000b';
end $$;

-- ---------------------------------------------------------------------------
-- The eight games. fisch and gag2 are in the app's switcher, and game_slug is
-- a foreign key, so a missing row is a game nobody can use.
-- ---------------------------------------------------------------------------
\echo ''
\echo 'GAMES'
do $$
declare n int; missing text[] := '{}'; g text;
begin
  foreach g in array array['blox-fruits','adopt-me',
                           'pet-simulator-99','creatures-of-sonaria',
                           'fisch','gag2'] loop
    if not exists (select 1 from public.games where slug = g) then
      missing := array_append(missing, g);
    end if;
  end loop;
  perform pg_temp.ok('all eight games in the registry have a row', missing = '{}');
end $$;

do $$ begin
  insert into public.inventory_entries (user_id, game_slug, item_id, kind)
  values ('bbbbbbbb-0000-0000-0000-00000000000b','fisch','fisch-rod-aether','have');
  insert into public.inventory_entries (user_id, game_slug, item_id, kind)
  values ('bbbbbbbb-0000-0000-0000-00000000000b','gag2','gag2-cosmetic-bookcase','want');
  perform pg_temp.ok('a Fisch and a GAG2 holding both save', true);
exception when others then
  perform pg_temp.ok('a Fisch and a GAG2 holding both save — ' || sqlerrm, false);
end $$;

-- ---------------------------------------------------------------------------
-- The services board
-- ---------------------------------------------------------------------------
\echo ''
\echo 'SERVICES BOARD'
do $$
declare t text; unprotected text[] := '{}';
begin
  foreach t in array array['service_listings','service_votes','service_picks','service_comments'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.'||t)::regclass) then
      unprotected := array_append(unprotected, t);
    end if;
  end loop;
  perform pg_temp.ok('row-level security is on for every board table', unprotected = '{}');
end $$;

set "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-00000000000a';
insert into public.service_listings
  (id, game_slug, author_id, side, service_ids, detail, ref_id, expires_at)
values ('cccccccc-0000-0000-0000-00000000000c', 'blox-fruits',
        'aaaaaaaa-0000-0000-0000-00000000000a', 'offer', '{bf-raid}',
        'two spots', 'ref-angel', now() + interval '90 minutes');

do $$ begin
  perform pg_temp.ok('a listing carries the ref_id postListing() writes',
    (select ref_id from public.service_listings
      where id = 'cccccccc-0000-0000-0000-00000000000c') = 'ref-angel');
end $$;

do $$ begin
  insert into public.service_votes (listing_id, user_id)
  values ('cccccccc-0000-0000-0000-00000000000c','aaaaaaaa-0000-0000-0000-00000000000a');
  perform pg_temp.ok('the author cannot vote on their own post', false);
exception when sqlstate 'P0001' then
  perform pg_temp.ok('the author cannot vote on their own post', true);
end $$;

insert into public.service_votes (listing_id, user_id)
values ('cccccccc-0000-0000-0000-00000000000c','bbbbbbbb-0000-0000-0000-00000000000b');

do $$ begin
  insert into public.service_votes (listing_id, user_id)
  values ('cccccccc-0000-0000-0000-00000000000c','bbbbbbbb-0000-0000-0000-00000000000b');
  perform pg_temp.ok('a second vote from the same person is refused', false);
exception when unique_violation then
  perform pg_temp.ok('a second vote from the same person is refused', true);
end $$;

do $$ begin
  insert into public.service_picks (listing_id, user_id)
  values ('cccccccc-0000-0000-0000-00000000000c','aaaaaaaa-0000-0000-0000-00000000000a');
  perform pg_temp.ok('somebody who never voted cannot be picked', false);
exception when foreign_key_violation then
  perform pg_temp.ok('somebody who never voted cannot be picked', true);
end $$;

do $$
declare v_at timestamptz;
begin
  insert into public.service_picks (listing_id, user_id)
  values ('cccccccc-0000-0000-0000-00000000000c','bbbbbbbb-0000-0000-0000-00000000000b');
  update public.service_picks set reply = 'agreed'
   where listing_id = 'cccccccc-0000-0000-0000-00000000000c';
  select replied_at into v_at from public.service_picks
   where listing_id = 'cccccccc-0000-0000-0000-00000000000c';
  perform pg_temp.ok('answering stamps replied_at from the database clock', v_at is not null);
end $$;

do $$
declare i int;
begin
  for i in 1..3 loop
    insert into public.service_listings (game_slug, author_id, side, service_ids, expires_at)
    values ('blox-fruits','aaaaaaaa-0000-0000-0000-00000000000a','offer','{bf-raid}',
            now() + interval '90 minutes');
  end loop;
  perform pg_temp.ok('a fourth live post in one game is refused', false);
exception when sqlstate 'P0001' then
  perform pg_temp.ok('a fourth live post in one game is refused', true);
end $$;

-- board_listings() is read by a mapper that destructures fixed keys. A rename
-- on either side renders every card empty rather than raising, so the keys are
-- asserted by name.
do $$
declare b jsonb; r jsonb;
begin
  b := public.board_listings('blox-fruits');
  perform pg_temp.ok('board_listings returns the live listing',
    jsonb_typeof(b) = 'array' and jsonb_array_length(b) = 1);

  r := b->0;
  perform pg_temp.ok('the board row carries every key the mapper reads',
    r ? 'id' and r ? 'game_slug' and r ? 'side' and r ? 'service_ids'
    and r ? 'terms_kind' and r ? 'terms_item_id' and r ? 'detail' and r ? 'ref_id'
    and r ? 'stage' and r ? 'created_at' and r ? 'expires_at' and r ? 'vote_cap'
    and r ? 'slots' and r ? 'window_minutes' and r ? 'vote_count'
    and r ? 'voters_online' and r ? 'you_voted' and r ? 'yours' and r ? 'author'
    and r ? 'author_avatar_url' and r ? 'author_online' and r ? 'voters'
    and r ? 'comments');

  perform pg_temp.ok('the voter carries the camelCase keys the mapper reads',
    r->'voters'->0 ? 'userId' and r->'voters'->0 ? 'username'
    and r->'voters'->0 ? 'avatarUrl' and r->'voters'->0 ? 'online'
    and r->'voters'->0 ? 'votedAt' and r->'voters'->0 ? 'reply');

  perform pg_temp.ok('the window is reported in minutes, not as a timestamp',
    (r->>'window_minutes')::int between 89 and 91);
  perform pg_temp.ok('the vote is counted', (r->>'vote_count')::int = 1);
  perform pg_temp.ok('the author sees it as theirs', (r->>'yours')::boolean);
end $$;

do $$
declare b jsonb;
begin
  -- created_at moves with it: the window CHECK insists a post lasts at least
  -- ten minutes, so expiry cannot be dragged back on its own.
  update public.service_listings
     set created_at = now() - interval '3 hours',
         expires_at = now() - interval '1 minute';
  b := public.board_listings('blox-fruits');
  perform pg_temp.ok('an expired post is off the board before the sweep runs',
    jsonb_array_length(b) = 0);
  perform pg_temp.ok('and the sweep then removes it',
    public.cleanup_service_listings() >= 1);
end $$;

-- ---------------------------------------------------------------------------
-- The panel. The gate is inside each function, because Supabase cannot gate an
-- RPC beyond `authenticated`.
-- ---------------------------------------------------------------------------
\echo ''
\echo 'CONTROL PANEL'
set "request.jwt.claim.sub" = 'bbbbbbbb-0000-0000-0000-00000000000b';
do $$ begin
  perform public.admin_save_game('{"slug":"hijacked","name":"Hijacked"}'::jsonb);
  perform pg_temp.ok('a normal player cannot write through an admin function', false);
exception when sqlstate 'P0001' then
  perform pg_temp.ok('a normal player cannot write through an admin function', true);
end $$;

do $$ begin
  perform public.admin_reports('open');
  perform pg_temp.ok('a normal player cannot read the report queue', false);
exception when sqlstate 'P0001' then
  perform pg_temp.ok('a normal player cannot read the report queue', true);
end $$;

do $$ begin
  perform pg_temp.ok('the console refuses a player outright',
    public.console_unlock('anything') is null);
end $$;

set "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-00000000000a';
do $$ begin
  perform pg_temp.ok('with no passcode set the console opens for nobody',
    public.console_unlock('anything') is null);
end $$;

do $$
declare v_token text;
begin
  perform mintplaza.set_console_passcode('open-sesame');
  perform pg_temp.ok('a wrong code is refused',
    public.console_unlock('not-it') is null);

  v_token := public.console_unlock('open-sesame');
  perform pg_temp.ok('the right code returns a token', v_token is not null);
  perform pg_temp.ok('the token opens the panel', public.console_unlocked(v_token));
  perform pg_temp.ok('a made-up token does not',
    public.console_unlocked('deadbeef') = false);
  perform pg_temp.ok('the raw token is never stored',
    not exists (select 1 from mintplaza.console_session where token_hash = v_token));

  perform public.console_lock(v_token);
  perform pg_temp.ok('locking retires the token',
    public.console_unlocked(v_token) = false);
end $$;

do $$
declare i int; v_token text;
begin
  for i in 1..5 loop perform public.console_unlock('wrong'); end loop;
  perform pg_temp.ok('five wrong answers stop it answering at all',
    public.console_unlock('open-sesame') is null);
  delete from mintplaza.console_attempt;
  v_token := public.console_unlock('open-sesame');
  perform pg_temp.ok('and it answers again once the window clears', v_token is not null);
end $$;

do $$
declare v_token text;
begin
  v_token := public.console_unlock('open-sesame');
  perform mintplaza.set_console_passcode('a-new-code');
  perform pg_temp.ok('changing the code retires every open session',
    public.console_unlocked(v_token) = false);
end $$;

-- ---------------------------------------------------------------------------
-- The phrase that reveals the panel in search
--
-- It used to be four words matched with IN — 'control panel', 'console',
-- 'studio', 'admin' — and three of those appear in this site's own help text.
-- It is one phrase now, matched whole. These run against the real function,
-- because the TypeScript proof can only read the SQL as text and a regex that
-- says "= '/openadminpanel'" proves the literal is there, not that Postgres
-- refuses everything else.
-- ---------------------------------------------------------------------------

do $$ begin
  -- Signed in as the owner. Every false below is the phrase being refused,
  -- not the account.
  perform pg_temp.ok('the exact phrase opens the panel',
    public.console_phrase_matches('/openadminpanel'));

  -- Forgiven, because a phone keyboard does both and the owner still has to
  -- be able to open their own panel on their own phone.
  perform pg_temp.ok('capitals are forgiven',
    public.console_phrase_matches('/OpenAdminPanel'));
  perform pg_temp.ok('surrounding spaces are forgiven',
    public.console_phrase_matches('   /openadminpanel  '));

  -- Not forgiven. One wrong character anywhere is a non-match.
  perform pg_temp.ok('a missing last letter is not a match',
    public.console_phrase_matches('/openadminpane') = false);
  perform pg_temp.ok('a missing middle letter is not a match',
    public.console_phrase_matches('/opnadminpanel') = false);
  perform pg_temp.ok('an extra letter is not a match',
    public.console_phrase_matches('/openadminpanell') = false);
  perform pg_temp.ok('no leading slash is not a match',
    public.console_phrase_matches('openadminpanel') = false);
  perform pg_temp.ok('spaces inside are not a match',
    public.console_phrase_matches('/open admin panel') = false);
  perform pg_temp.ok('the phrase as a prefix of something longer is not a match',
    public.console_phrase_matches('/openadminpanel now') = false);
  perform pg_temp.ok('the phrase as a suffix of something longer is not a match',
    public.console_phrase_matches('please /openadminpanel') = false);

  -- The four words it used to answer to. Every one of these is a word a
  -- player could plausibly type into a search box.
  perform pg_temp.ok('"admin" no longer opens anything',
    public.console_phrase_matches('admin') = false);
  perform pg_temp.ok('"console" no longer opens anything',
    public.console_phrase_matches('console') = false);
  perform pg_temp.ok('"studio" no longer opens anything',
    public.console_phrase_matches('studio') = false);
  perform pg_temp.ok('"control panel" no longer opens anything',
    public.console_phrase_matches('control panel') = false);

  -- Degenerate input answers false rather than erroring, because an error is
  -- a different response from a non-match and a different response is a signal.
  perform pg_temp.ok('null is not a match',
    public.console_phrase_matches(null) = false);
  perform pg_temp.ok('an empty string is not a match',
    public.console_phrase_matches('') = false);
end $$;

-- And the phrase is worth nothing to anybody else. This is the part that
-- matters: the phrase is not a password, is_admin() is the lock.
set "request.jwt.claim.sub" = 'bbbbbbbb-0000-0000-0000-00000000000b';
do $$ begin
  perform pg_temp.ok('the exact phrase does nothing for another account',
    public.console_phrase_matches('/openadminpanel') = false);
end $$;
set "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-00000000000a';

-- The owner's own writes, which is the other half of the gate being worth
-- anything.
do $$
declare v_id uuid; n int;
begin
  perform public.admin_save_game(
    '{"slug":"test-game","name":"Test Game","short_name":"Test",
      "modules":["trades"],"item_categories":["Thing"],
      "explore_tabs":[{"id":"trades","label":"Market","kind":"trades"}]}'::jsonb);
  perform pg_temp.ok('the owner can add a game',
    exists (select 1 from public.games where slug = 'test-game'));

  perform public.admin_set_game_active('test-game', false);
  perform pg_temp.ok('and retire it',
    (select is_active from public.games where slug = 'test-game') = false);

  perform public.admin_set_explore_tabs('test-game',
    '[{"id":"trades","label":"Renamed","kind":"trades"}]'::jsonb);
  perform pg_temp.ok('and rename its tabs',
    (select explore_tabs->0->>'label' from public.games where slug='test-game') = 'Renamed');

  v_id := public.admin_add_media('/x.png', 'A picture', 'item', 'test-game');
  perform pg_temp.ok('and put a picture on the shelf', v_id is not null);
  perform public.admin_delete_media(v_id);
  perform pg_temp.ok('and take it off',
    not exists (select 1 from public.media where id = v_id));

  perform public.admin_save_template(
    '{"id":"test-raid","game_slug":"test-game","name":"Test Raid","kind":"Raid",
      "section":"services","players":"2"}'::jsonb);
  perform pg_temp.ok('and save a template',
    exists (select 1 from public.service_templates where id = 'test-raid'));

  perform public.admin_reorder_games(array['test-game']);
  perform pg_temp.ok('and reorder the list',
    (select sort_order from public.games where slug = 'test-game') = 1);
end $$;

-- The rule that keeps the two boards from becoming one board.
do $$ begin
  perform public.admin_save_template(
    '{"id":"too-big","game_slug":"test-game","name":"Too Big","kind":"Raid",
      "section":"services","players":"8"}'::jsonb);
  perform pg_temp.ok('a services template cannot need eight players', false);
exception when sqlstate 'P0001' then
  perform pg_temp.ok('a services template cannot need eight players', true);
end $$;

-- ---------------------------------------------------------------------------
-- Reports, end to end: the button and the queue behind it.
-- ---------------------------------------------------------------------------
\echo ''
\echo 'REPORTS'
set "request.jwt.claim.sub" = 'bbbbbbbb-0000-0000-0000-00000000000b';
insert into public.reports (reporter_id, subject_type, subject_id, reason, subject_label)
values ('bbbbbbbb-0000-0000-0000-00000000000b', 'user',
        'aaaaaaaa-0000-0000-0000-00000000000a', 'scam', 'OwnerPerson');

set "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-00000000000a';
do $$
declare q jsonb;
begin
  q := public.admin_reports('open');
  perform pg_temp.ok('the report reaches the queue', jsonb_array_length(q) = 1);
  perform pg_temp.ok('the queue names the reporter',
    q->0->>'reporter_username' = 'SomePlayer');
  perform pg_temp.ok('and carries the keys the panel reads',
    q->0 ? 'id' and q->0 ? 'created_at' and q->0 ? 'status'
    and q->0 ? 'subject_type' and q->0 ? 'subject_id' and q->0 ? 'subject_label'
    and q->0 ? 'reason' and q->0 ? 'detail' and q->0 ? 'evidence_url'
    and q->0 ? 'reporter_username' and q->0 ? 'reporter_roblox_id'
    and q->0 ? 'admin_note');

  perform public.admin_resolve_report(
    (q->0->>'id')::uuid, 'actioned', 'warned them');
  perform pg_temp.ok('resolving it closes it',
    (select status from public.reports limit 1) = 'actioned');
  perform pg_temp.ok('and records who looked',
    (select reviewed_by from public.reports limit 1)
      = 'aaaaaaaa-0000-0000-0000-00000000000a');
end $$;

-- ---------------------------------------------------------------------------
-- Value history, which is what makes an edit reversible.
-- ---------------------------------------------------------------------------
\echo ''
\echo 'VALUES ARE GONE, AND STAY GONE'
-- MintPlaza kept its own value table, a W/F/L calculator and a history table so
-- a mistyped value could be undone. All three were removed — see
-- src/lib/referrals.ts. These checks are the inverse of the ones that used to
-- live here: they prove the teardown actually ran, because a half-removed value
-- system is the worst of both, with numbers still in the database and nothing
-- left to correct them with.
do $$
declare v_item uuid; n int; a jsonb;
begin
  perform pg_temp.ok('the value history table is gone',
    to_regclass('public.item_value_history') is null);

  perform pg_temp.ok('and so is the trigger that fed it',
    not exists (select 1 from pg_trigger
                 where tgname = 'game_items_value_history' and not tgisinternal));

  perform pg_temp.ok('and the function behind it',
    to_regproc('public.record_item_value') is null);

  -- The important one. A live database still holds valuePhysical and friends in
  -- attributes long after the app stops reading them, and a stale number that
  -- can be resurrected by a future reader is exactly what this change exists to
  -- prevent. The schema strips them; this proves it.
  select count(*) into n from public.game_items
   where attributes ?| array['valuePhysical', 'valuePermanent', 'demand'];
  perform pg_temp.ok('no catalogue row still carries a value or a demand', n = 0);

  -- Beli and Robux survive on purpose: they are the game's own shop prices,
  -- published by the developer, and they do not move.
  insert into public.game_items (game_slug, name, category, attributes)
  values ('test-game','Thing','Thing','{"slug":"tg-thing","beli":1900000,"robux":2000}')
  returning id into v_item;
  select attributes into a from public.game_items where id = v_item;
  perform pg_temp.ok('the game''s own shop prices are still storable',
    (a->>'beli') = '1900000' and (a->>'robux') = '2000');

  -- And a write of them does not resurrect a history table by any other name.
  update public.game_items set attributes = attributes || '{"beli":2100000}'::jsonb
   where id = v_item;
  perform pg_temp.ok('editing a price writes nothing anywhere else',
    to_regclass('public.item_value_history') is null);
end $$;

-- ---------------------------------------------------------------------------
-- Nothing in the RPC surface is reachable signed out. Supabase grants EXECUTE
-- to anon by default on everything in public, so this is the check that the
-- revokes actually landed.
-- ---------------------------------------------------------------------------
\echo ''
\echo 'ANON'
-- is_admin() is deliberately NOT in this list. It is read inside RLS policies,
-- and a policy is evaluated as whoever is querying, so revoking it from anon
-- turns a read that should return nothing into "permission denied for
-- function". It answers from auth.uid(), which is null when signed out, so to
-- anon it is a function that returns false.
do $$ begin
  perform pg_temp.ok('is_admin stays callable by anon, because a policy reads it',
    has_function_privilege('anon', 'public.is_admin()', 'EXECUTE'));
end $$;

do $$
declare fn text; leaked text[] := '{}';
begin
  foreach fn in array array[
    'ensure_profile','save_profile','add_proof','delete_proof',
    'add_contact','remove_contact','delete_my_account','set_display_name',
    'set_hide_presence','touch_presence','console_unlock','console_unlocked',
    'console_lock','console_phrase_matches','admin_reports','admin_save_game',
    'admin_save_template','admin_add_media','admin_delete_media',
    'admin_reorder_games','admin_set_game_active','admin_set_explore_tabs',
    'admin_set_template_active','admin_resolve_report','post_trade_listing',
    'cancel_trade_listing','bump_listing','listing_allowance',
    'trade_match_candidates','my_trade_listings','expire_listings'
  ] loop
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = fn
         and has_function_privilege('anon', p.oid, 'EXECUTE')
    ) then leaked := array_append(leaked, fn);
    end if;
  end loop;
  perform pg_temp.ok(
    format('nothing private is callable by a signed-out visitor%s',
           case when leaked = '{}' then '' else ' (reachable: ' || array_to_string(leaked, ', ') || ')' end),
    leaked = '{}');
end $$;

-- ---------------------------------------------------------------------------
\echo ''
\echo 'REPORT KINDS'
--
-- The interface offers three: player, comment, listing. Two of them were
-- rejected by this table's CHECK for months, because the action inserted the
-- interface's words rather than the table's and then swallowed the error.
-- Every one of those reports was lost. The mapping now lives in
-- src/lib/actions/board.ts (SUBJECT_TYPE); these are the values it produces.
-- ---------------------------------------------------------------------------
do $$
declare k text; rejected text[] := '{}';
begin
  foreach k in array array['user', 'message', 'listing'] loop
    begin
      insert into public.reports (reporter_id, subject_type, subject_id, reason)
      values ('bbbbbbbb-0000-0000-0000-00000000000b', k,
              'aaaaaaaa-0000-0000-0000-00000000000a', 'test');
    exception when check_violation then
      rejected := array_append(rejected, k);
    end;
  end loop;
  perform pg_temp.ok(
    format('every report kind the interface offers is storable%s',
      case when rejected = '{}' then '' else ' — REJECTED: ' || array_to_string(rejected, ', ') end),
    rejected = '{}');
end $$;

-- ---------------------------------------------------------------------------
\echo ''
\echo 'SUPPORT'
-- ---------------------------------------------------------------------------
set "request.jwt.claim.sub" = 'bbbbbbbb-0000-0000-0000-00000000000b';

do $$ begin
  insert into public.support_messages (user_id, body, context)
  values ('bbbbbbbb-0000-0000-0000-00000000000b', 'the trades screen is blank', 'pet-simulator-99');
  perform pg_temp.ok('a player can send a support message', true);
exception when others then
  perform pg_temp.ok('a player can send a support message — ' || sqlerrm, false);
end $$;

do $$ begin
  insert into public.support_messages (user_id, body) values
    ('bbbbbbbb-0000-0000-0000-00000000000b', '   ');
  perform pg_temp.ok('an empty message is refused', false);
exception when check_violation then
  perform pg_temp.ok('an empty message is refused', true);
end $$;

do $$
declare i int;
begin
  for i in 1..5 loop
    insert into public.support_messages (user_id, body)
    values ('bbbbbbbb-0000-0000-0000-00000000000b', 'message ' || i);
  end loop;
  perform pg_temp.ok('the five-a-day limit bites', false);
exception when sqlstate 'P0001' then
  perform pg_temp.ok('the five-a-day limit bites', true);
end $$;

do $$
declare q jsonb;
begin
  q := public.admin_support_messages('open');
  perform pg_temp.ok('a normal player cannot read the support queue', false);
exception when sqlstate 'P0001' then
  perform pg_temp.ok('a normal player cannot read the support queue', true);
end $$;

set "request.jwt.claim.sub" = 'aaaaaaaa-0000-0000-0000-00000000000a';
do $$
declare q jsonb;
begin
  q := public.admin_support_messages('open');
  perform pg_temp.ok('the owner sees the queue', jsonb_array_length(q) >= 1);
  perform pg_temp.ok('and it carries the keys the panel reads',
    q->0 ? 'id' and q->0 ? 'created_at' and q->0 ? 'status' and q->0 ? 'body'
    and q->0 ? 'context' and q->0 ? 'admin_note' and q->0 ? 'resolved_at'
    and q->0 ? 'sender_username' and q->0 ? 'sender_roblox_id');
  perform pg_temp.ok('and names who sent it',
    q->0->>'sender_username' = 'SomePlayer');

  perform public.admin_resolve_support((q->0->>'id')::uuid, 'answered', 'fixed it');
  perform pg_temp.ok('resolving one closes it',
    (select status from public.support_messages
      where id = (q->0->>'id')::uuid) = 'answered');
end $$;

-- ---------------------------------------------------------------------------
-- ANNOUNCEMENTS
--
-- Applying the schema is not enough to know this works. A CHECK constraint's
-- expression is not evaluated until a row is written, so the first version of
-- this table created perfectly and then threw on every single insert: the
-- media URL check used '{1,2000}' and Postgres caps regex repetition at 255.
-- Nothing in the apply step could have caught it. Writing a row can, so these
-- write rows.
-- ---------------------------------------------------------------------------
\echo ''
\echo 'ANNOUNCEMENTS'
do $$
declare v_id uuid; v_admin uuid; v_other uuid;
begin
  select id into v_admin from public.profiles order by joined_at limit 1;
  select id into v_other from public.profiles where id <> v_admin limit 1;

  -- A plain insert with a picture. This is the one the regex broke.
  insert into public.announcements (title, body, media_url, media_kind, expires_at)
  values ('Live', 'Body text', 'https://cdn.example.com/a/very/long/path.png', 'image',
          now() + interval '5 days')
  returning id into v_id;
  perform pg_temp.ok('an announcement with a picture can actually be written', v_id is not null);

  -- And one without, which must also be allowed.
  insert into public.announcements (title, body, expires_at)
  values ('Plain', 'No picture', now() + interval '1 day');
  perform pg_temp.ok('and one without a picture', true);

  begin
    insert into public.announcements (title, body, media_url, media_kind, expires_at)
    values ('Bad', 'x', 'javascript:alert(1)', 'image', now() + interval '1 day');
    perform pg_temp.ok('a javascript: attachment is refused', false);
  exception when check_violation then
    perform pg_temp.ok('a javascript: attachment is refused', true);
  end;

  begin
    insert into public.announcements (title, body, media_url, media_kind, expires_at)
    values ('Bad', 'x', 'http://plain.example/p.png', 'image', now() + interval '1 day');
    perform pg_temp.ok('a plain http attachment is refused', false);
  exception when check_violation then
    perform pg_temp.ok('a plain http attachment is refused', true);
  end;

  begin
    insert into public.announcements (title, body, media_url, expires_at)
    values ('Bad', 'x', 'https://ok.example/p.png', now() + interval '1 day');
    perform pg_temp.ok('an attachment with no kind beside it is refused', false);
  exception when check_violation then
    perform pg_temp.ok('an attachment with no kind beside it is refused', true);
  end;

  begin
    insert into public.announcements (title, body, starts_at, expires_at)
    values ('Bad', 'x', now(), now() - interval '1 second');
    perform pg_temp.ok('one that ends before it starts is refused', false);
  exception when check_violation then
    perform pg_temp.ok('one that ends before it starts is refused', true);
  end;

  -- live_announcement() picks the newest running one and skips a dismissal.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  perform pg_temp.ok('a player is shown one',
    (select count(*) from public.live_announcement()) = 1);
  perform pg_temp.ok('and only ever one at a time',
    (select count(*) from public.live_announcement()) <= 1);

  perform public.dismiss_announcement((select id from public.live_announcement()));
  perform pg_temp.ok('dont-show-again hides that one',
    not exists (select 1 from public.live_announcement() a
                 join public.announcement_dismissals d
                   on d.announcement_id = a.id and d.user_id = v_other));

  -- Expiring one takes it away without deleting anything.
  update public.announcements
     set starts_at = now() - interval '9 days', expires_at = now() - interval '8 days';
  perform pg_temp.ok('an expired announcement is shown to nobody',
    (select count(*) from public.live_announcement()) = 0);
  perform pg_temp.ok('but it is still on record',
    (select count(*) from public.announcements) >= 2);

  perform set_config('request.jwt.claims', '', true);
end $$;


-- ===========================================================================
-- Finalising a deal opens the party
--
-- The end of the recruitment flow: people vote, the host picks, the picked
-- players agree, and the host finalises. Before this, finalising only moved
-- the stage to 'locked' — everybody who had just said yes to a raid was left
-- to go and find each other by username, one at a time.
--
-- Five things happen at once and none of them is a state the site has a screen
-- for on its own, which is why they are one function.
-- ===========================================================================
\echo ''
\echo 'FINALISING A DEAL'

insert into auth.users (id, email) values
  ('b1000000-0000-0000-0000-000000000001', 'host@party.test'),
  ('b1000000-0000-0000-0000-000000000002', 'yes1@party.test'),
  ('b1000000-0000-0000-0000-000000000003', 'yes2@party.test'),
  ('b1000000-0000-0000-0000-000000000004', 'no1@party.test'),
  ('b1000000-0000-0000-0000-000000000009', 'outsider@party.test');
update public.profiles set username = 'partyhost' where id = 'b1000000-0000-0000-0000-000000000001';
update public.profiles set username = 'yes1'      where id = 'b1000000-0000-0000-0000-000000000002';
update public.profiles set username = 'yes2'      where id = 'b1000000-0000-0000-0000-000000000003';
update public.profiles set username = 'no1'       where id = 'b1000000-0000-0000-0000-000000000004';
update public.profiles set username = 'outsider'  where id = 'b1000000-0000-0000-0000-000000000009';
insert into public.terms_acceptance (user_id, version)
select id, '2026-09-18' from public.profiles
 where id::text like 'b1000000%' on conflict do nothing;

insert into public.service_listings
  (id, game_slug, author_id, side, service_ids, stage, expires_at)
values ('b1c00000-0000-0000-0000-0000000000c1', 'blox-fruits',
        'b1000000-0000-0000-0000-000000000001', 'offer', '{bf-raid}',
        'requested', now() + interval '90 minutes');

-- A pick can only name somebody who voted — there is a composite foreign key
-- that says so, and it is the reason this fixture votes first.
insert into public.service_votes (listing_id, user_id) values
  ('b1c00000-0000-0000-0000-0000000000c1', 'b1000000-0000-0000-0000-000000000002'),
  ('b1c00000-0000-0000-0000-0000000000c1', 'b1000000-0000-0000-0000-000000000003'),
  ('b1c00000-0000-0000-0000-0000000000c1', 'b1000000-0000-0000-0000-000000000004');
insert into public.service_picks (listing_id, user_id, reply) values
  ('b1c00000-0000-0000-0000-0000000000c1', 'b1000000-0000-0000-0000-000000000002', 'agreed'),
  ('b1c00000-0000-0000-0000-0000000000c1', 'b1000000-0000-0000-0000-000000000003', 'agreed'),
  ('b1c00000-0000-0000-0000-0000000000c1', 'b1000000-0000-0000-0000-000000000004', 'denied');

-- Only the host finalises. Anybody else finalising somebody's deal would open
-- a group chat in their name.
set "request.jwt.claim.sub" = 'b1000000-0000-0000-0000-000000000009';
do $$
declare v_got_in boolean := false;
begin
  begin
    perform public.finalize_deal('b1c00000-0000-0000-0000-0000000000c1', false);
    v_got_in := true;
  exception when others then v_got_in := false;
  end;
  perform pg_temp.ok('only the host can finalise their own deal', not v_got_in);
end $$;

set "request.jwt.claim.sub" = 'b1000000-0000-0000-0000-000000000001';
do $$
declare r jsonb;
begin
  r := public.finalize_deal('b1c00000-0000-0000-0000-0000000000c1', true);
  -- The host plus the two who agreed. The one who said no is not in it.
  perform pg_temp.ok('the party holds the host and everybody who agreed',
    (r->>'member_count')::int = 3);
  perform pg_temp.ok('and it is named after the game and its size',
    r->>'title' like 'Blox Fruits%3 players');
  perform pg_temp.ok('and the post is locked',
    (select stage from public.service_listings
      where id = 'b1c00000-0000-0000-0000-0000000000c1') = 'locked');
  perform pg_temp.ok('and whether an ad was shown is recorded',
    (select finalize_ad_shown from public.service_listings
      where id = 'b1c00000-0000-0000-0000-0000000000c1'));
end $$;

do $$
declare n int;
begin
  select count(*) into n from public.conversation_participants p
   join public.conversations c on c.id = p.conversation_id
   where c.kind = 'party' and p.user_id = 'b1000000-0000-0000-0000-000000000004';
  perform pg_temp.ok('a player who said no is not put in the party', n = 0);
end $$;

-- Idempotent. The finalise button sits behind an ad, and an ad times out, gets
-- blocked, or is tapped twice — every one of those ends in a retry, and a
-- retry must not open a second chat with the same people in it.
do $$
declare r1 jsonb; r2 jsonb; n int;
begin
  r1 := public.finalize_deal('b1c00000-0000-0000-0000-0000000000c1', false);
  r2 := public.finalize_deal('b1c00000-0000-0000-0000-0000000000c1', false);
  select count(*) into n from public.conversations
   where service_listing_id = 'b1c00000-0000-0000-0000-0000000000c1';
  perform pg_temp.ok('finalising twice returns the same party, not a second one',
    n = 1 and (r1->>'conversation_id') = (r2->>'conversation_id')
      and (r2->>'already_open')::boolean);
end $$;

-- The notice, and the thread the members actually read.
do $$
declare t jsonb; v_conv uuid;
begin
  select id into v_conv from public.conversations
   where service_listing_id = 'b1c00000-0000-0000-0000-0000000000c1';
  t := public.conversation_thread(v_conv);
  perform pg_temp.ok('the thread knows it is a party and names itself',
    t->>'kind' = 'party' and t->>'title' is not null);
  perform pg_temp.ok('and lists every member so nobody speaks unattributed',
    jsonb_array_length(t->'members') = 3);
  perform pg_temp.ok('and opens with a pinned notice',
    (t->'pinned') is not null and length(t->'pinned'->>'body') > 80);
  -- It answers the question every one of these deals raises — where do we get
  -- a private server — and it carries the warning that has to travel with that
  -- answer. "Free private server" is the most common bait in Roblox scams and
  -- the people reading this are thirteen.
  perform pg_temp.ok('which points at private servers AND says not to pay for one',
    t->'pinned'->>'body' ilike '%private server%'
    and t->'pinned'->>'body' ilike '%nobody pays%'
    and t->'pinned'->>'body' ilike '%password%');
end $$;

-- The inbox, which is where the N-participant bug actually showed.
set "request.jwt.claim.sub" = 'b1000000-0000-0000-0000-000000000002';
do $$
declare c jsonb;
begin
  c := public.my_conversations();
  -- Three people in the party. The old reader joined one row per OTHER
  -- participant, so this was 2 — the same chat listed twice, under a different
  -- member's name each time, with the same unread badge on both.
  perform pg_temp.ok('a party appears in the inbox exactly once',
    jsonb_array_length(c) = 1);
  perform pg_temp.ok('as a party, with its name and its size',
    c->0->>'kind' = 'party' and (c->0->>'member_count')::int = 3
      and c->0->>'title' is not null);
end $$;

set "request.jwt.claim.sub" = 'b1000000-0000-0000-0000-000000000009';
do $$
declare v_read boolean := false; v_conv uuid;
begin
  perform pg_temp.ok('somebody not in the party does not see it in their inbox',
    jsonb_array_length(public.my_conversations()) = 0);
  select id into v_conv from public.conversations
   where service_listing_id = 'b1c00000-0000-0000-0000-0000000000c1';
  begin
    perform public.conversation_thread(v_conv);
    v_read := true;
  exception when others then v_read := false;
  end;
  perform pg_temp.ok('nor can they open it by id', not v_read);
end $$;
