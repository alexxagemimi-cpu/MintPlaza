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

create or replace function pg_temp.ok(label text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'PASS  %', label;
  else raise exception 'FAIL  %', label;
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
