-- ===========================================================================
-- MintPlaza — database schema, security policies and business rules
--
-- Paste this whole file into the Supabase SQL editor and run it once.
-- It is idempotent enough to re-run during development, but it is not a
-- migration system: once real users exist, change the database with new,
-- separate migration files rather than by editing this one.
--
-- The important thing in here is that the rules the product depends on live
-- in the database, not in the browser and not only in the API layer. A user
-- with a valid token calling PostgREST directly still cannot exceed the
-- listing limit, read someone else's messages, or forge a timestamp.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Before anything else: where this file looks for things
--
-- Supabase does not install extensions into public. pgcrypto and pg_trgm live
-- in a schema called `extensions`, and Supabase papers over that by adding it
-- to the search_path of its own roles. Every statement below that names an
-- extension-provided object — the two gin_trgm_ops indexes especially — is
-- therefore relying on a role setting rather than on anything in this file.
--
-- Verified: with pg_trgm in `extensions` and a search_path of just
-- `public, pg_catalog`, the index two statements down fails outright with
-- "operator class gin_trgm_ops does not exist". That is the third statement in
-- the file, so the whole thing stops there.
--
-- Setting it here makes the file independent of who runs it and how. It lasts
-- for this session only and changes nothing permanently. `extensions` is named
-- even on databases that have no such schema, which Postgres simply ignores.
-- ---------------------------------------------------------------------------
set search_path = public, extensions, pg_catalog;

-- The extensions themselves. Guarded because a project can be configured so
-- that the role running this cannot create extensions — in which case they are
-- almost certainly already installed, and stopping the whole file over an
-- "if not exists" that was going to be a no-op anyway helps nobody.
do $$
begin
  create extension if not exists "pgcrypto";
exception when insufficient_privilege then
  raise notice 'Could not create pgcrypto (%). If it is already installed this changes nothing; if it is not, enable it under Database -> Extensions.', sqlerrm;
end $$;

do $$
begin
  create extension if not exists "pg_trgm";   -- fuzzy item-name search
exception when insufficient_privilege then
  raise notice 'Could not create pg_trgm (%). If it is already installed this changes nothing; if it is not, enable it under Database -> Extensions.', sqlerrm;
end $$;

-- Both are required, not optional, and failing here with a sentence beats
-- failing forty statements later on an operator class nobody can place.
do $$
declare missing text[] := '{}';
begin
  if to_regproc('gen_random_uuid') is null then missing := array_append(missing, 'pgcrypto'); end if;
  if not exists (select 1 from pg_opclass where opcname = 'gin_trgm_ops') then
    missing := array_append(missing, 'pg_trgm');
  end if;
  if missing <> '{}' then
    raise exception 'Missing required extension(s): %. Enable them under Database -> Extensions, then run this file again.',
      array_to_string(missing, ' and ');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tuning knobs. Changing a rule means changing it here, in one place.
-- ---------------------------------------------------------------------------
create schema if not exists mintplaza;

-- ---------------------------------------------------------------------------
-- Adding a CHECK to a table that already holds rows
--
-- ALTER TABLE ... ADD CONSTRAINT validates every existing row, and one that
-- fails takes down the whole file:
--
--   ERROR: check constraint "service_listings_window_check" of relation
--          "service_listings" is violated by some row
--
-- which names neither the row nor what to do about it, and stops every
-- statement after it — including, in this file, the inventory fix that is the
-- main reason anybody is running it.
--
-- Neither obvious response is right on its own. Aborting punishes the whole
-- migration for a handful of rows written before the rule existed. Skipping
-- silently leaves the table unprotected while the file reports success, which
-- is worse, because nothing will ever mention it again.
--
-- So: apply it, and if existing rows fail, say how many and leave a WARNING
-- that names the constraint. The rest of the file still lands, and the person
-- running it is told precisely what to clean up before running it again.
-- ---------------------------------------------------------------------------
create or replace function mintplaza.add_check(
  p_table text, p_name text, p_expr text
) returns void language plpgsql as $$
declare v_bad bigint;
begin
  execute format('alter table %s drop constraint if exists %I', p_table, p_name);
  begin
    execute format('alter table %s add constraint %I check (%s)', p_table, p_name, p_expr);
  exception when check_violation then
    execute format('select count(*) from %s where not (%s)', p_table, p_expr) into v_bad;
    raise warning
      'Could not add % to %: % existing row(s) break it. The rule is NOT in force on that table. Fix or delete those rows (select * from % where not (%)) and run this file again.',
      p_name, p_table, v_bad, p_table, p_expr;
  end;
end $$;

revoke all on function mintplaza.add_check(text, text, text) from public, anon, authenticated;

-- How long a used listing slot takes to come back, and how many there are.
--
-- ---------------------------------------------------------------------------
-- Why this window is a day and not three hours
-- ---------------------------------------------------------------------------
--
-- It was three listings every three hours, which sounds like a limit and is
-- not one. Three hours is shorter than an afternoon, so a free account that
-- posted, traded and moved on had its slots back before it wanted them: three
-- an hour of wall-clock patience, twenty-four in a day, and a board that one
-- determined person could fill on their own for free.
--
-- The rate limit has to be slower than the behaviour it is limiting. Posting a
-- listing, finding a trade and closing it takes well under an hour, so any
-- window measured in hours refills faster than a player can use it. A day is
-- the first window that does not: four listings, and the fourth one back
-- tomorrow.
--
-- The window is also what Level Up actually sells now. See
-- mintplaza.listing_window_for().
create or replace function mintplaza.listing_window() returns interval
  language sql immutable as $$ select interval '24 hours' $$;

create or replace function mintplaza.listings_per_window() returns int
  language sql immutable as $$ select 4 $$;

-- How many listings one account may have LIVE in one game at a time.
--
-- This is the number a player actually feels, and the one the upgrade page
-- means by "10 listings instead of 4". The per-window cap above is a rate
-- limit — it stops a burst — while this one decides how much of the board any
-- single person can occupy at once.
--
-- It is four rather than three so that it agrees with the window above. A free
-- listing lives 24 hours and the window is 24 hours, so all four of a free
-- player's daily listings are live at the same moment by construction. A
-- per-game cap of three would refuse the fourth one every single time, and the
-- site would be promising a listing it always refused to take.
create or replace function mintplaza.max_active_per_game() returns int
  language sql immutable as $$ select 4 $$;

-- A day, and that is deliberately short.
--
-- It was seven days, which is how a trading board fills with listings for
-- items that were traded away last Tuesday. A player scrolling past four dead
-- posts stops trusting the fifth, and the site's whole job is to be the place
-- where what you see is still available. A day is long enough that posting in
-- the evening still works the next morning, and short enough that the board is
-- never mostly ghosts.
create or replace function mintplaza.listing_lifetime() returns interval
  language sql immutable as $$ select interval '24 hours' $$;


-- ===========================================================================
-- Profiles
-- ===========================================================================

create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  -- The Roblox account id. Immutable, and unique: one Roblox account is one
  -- MintPlaza account, which closes most duplicate-account abuse.
  roblox_user_id    text not null unique,
  username          text not null,
  display_name      text,
  avatar_url        text,
  -- Roblox account creation date. A trust input that cannot be farmed quickly.
  roblox_created_at timestamptz,
  bio               text check (char_length(bio) <= 400),
  status            text not null default 'active'
                    check (status in ('active', 'restricted', 'suspended')),
  joined_at         timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles using gin (username gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Creating the profile row
--
-- Two paths, because the obvious one is not always permitted. Supabase locks
-- down the `auth` schema, and on most projects the SQL editor's role does not
-- own `auth.users` — attempting a trigger there fails with
-- "must be owner of relation users" and, worse, aborts the whole script.
--
-- So: try the trigger, and carry on without it if the project will not allow
-- it. Either way `ensure_profile()` is the guaranteed path — the app calls it
-- once after sign-in, and it is idempotent, so it costs nothing when the
-- trigger already did the work.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, roblox_user_id, username, display_name, avatar_url, roblox_created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'sub', new.id::text),
    coalesce(new.raw_user_meta_data ->> 'preferred_username', 'player'),
    new.raw_user_meta_data ->> 'nickname',
    new.raw_user_meta_data ->> 'picture',
    case
      when new.raw_user_meta_data ? 'created_at'
      then to_timestamp((new.raw_user_meta_data ->> 'created_at')::bigint)
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end $$;

do $$
begin
  execute 'drop trigger if exists on_auth_user_created on auth.users';
  execute 'create trigger on_auth_user_created
             after insert on auth.users
             for each row execute function public.handle_new_user()';
  raise notice 'Profile trigger installed on auth.users.';
exception
  when insufficient_privilege or undefined_table then
    raise notice 'Could not attach a trigger to auth.users (%). This is normal on Supabase — ensure_profile() covers it.', sqlerrm;
end $$;

/**
 * Called by the app immediately after sign-in.
 *
 * Reads the signed-in user's own claims — it cannot be used to create a
 * profile for anybody else, because auth.uid() is whoever is calling.
 */
create or replace function public.ensure_profile()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid   := auth.uid();
  v_meta jsonb  := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);
begin
  if v_uid is null then
    return;
  end if;

  insert into public.profiles (id, roblox_user_id, username, display_name, avatar_url, roblox_created_at)
  values (
    v_uid,
    coalesce(v_meta ->> 'sub', v_meta ->> 'provider_id', v_uid::text),
    coalesce(v_meta ->> 'preferred_username', v_meta ->> 'name', 'player'),
    coalesce(v_meta ->> 'nickname', v_meta ->> 'full_name'),
    coalesce(v_meta ->> 'picture', v_meta ->> 'avatar_url'),
    case
      when v_meta ? 'created_at' and (v_meta ->> 'created_at') ~ '^[0-9]+$'
      then to_timestamp((v_meta ->> 'created_at')::bigint)
      else null
    end
  )
  on conflict (id) do nothing;

  -- Runs on every sign-in, not only the one that creates the profile: the
  -- owner may well have signed in before the allowlist row existed. Defined
  -- further down; see "Binding the owner's account".
  perform mintplaza.bind_admin_on_first_signin();
exception
  -- Another Roblox id already claimed: leave the existing row alone rather
  -- than failing the sign-in.
  when unique_violation then
    perform mintplaza.bind_admin_on_first_signin();
    return;
end $$;

revoke all on function public.ensure_profile() from public;
grant execute on function public.ensure_profile() to authenticated;

-- ===========================================================================
-- Games and items
-- ===========================================================================

create table if not exists public.games (
  slug            text primary key,
  name            text not null,
  short_name      text not null,
  blurb           text,
  modules         text[] not null default '{}',
  activity_kinds  text[] not null default '{}',
  item_categories text[] not null default '{}',
  item_attributes jsonb not null default '[]',
  hue             text,
  art             text,
  is_active       boolean not null default true,
  sort_order      int not null default 0
);

create table if not exists public.game_items (
  id            uuid primary key default gen_random_uuid(),
  game_slug     text not null references public.games(slug) on delete cascade,
  name          text not null,
  category      text,
  attributes    jsonb not null default '{}',
  is_active     boolean not null default true,
  -- Game data goes stale. Nothing here is presented as current without this.
  verified_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (game_slug, name)
);

create index if not exists game_items_search_idx on public.game_items using gin (name gin_trgm_ops);
create index if not exists game_items_game_idx on public.game_items (game_slug) where is_active;


-- ===========================================================================
-- Inventory — what powers matching
-- ===========================================================================

create table if not exists public.inventory_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  game_slug   text not null references public.games(slug) on delete cascade,
  item_id     uuid references public.game_items(id) on delete set null,
  -- Free text for items not yet in the catalogue. One of item_id / custom_name.
  custom_name text,
  kind        text not null check (kind in ('have', 'want')),
  quantity    int not null default 1 check (quantity between 1 and 9999),
  attributes  jsonb not null default '{}',
  note        text check (char_length(note) <= 280),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint inventory_needs_an_item check (item_id is not null or custom_name is not null)
);

create index if not exists inventory_user_game_idx on public.inventory_entries (user_id, game_slug, kind);
create index if not exists inventory_item_idx on public.inventory_entries (item_id, kind);

create table if not exists public.inventory_proofs (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.inventory_entries(id) on delete cascade,
  storage_path text not null,
  -- When the screenshot was taken, not when it was uploaded. Always displayed:
  -- an old screenshot is evidence, never proof of current ownership.
  captured_at timestamptz,
  uploaded_at timestamptz not null default now(),
  status      text not null default 'submitted'
              check (status in ('submitted', 'hidden', 'removed'))
);

create index if not exists inventory_proofs_entry_idx on public.inventory_proofs (entry_id);



-- ===========================================================================
-- ===========================================================================
-- Level Up
--
-- A 60-day subscription. This block is the part that decides what somebody
-- HAS; what they PAY is in src/lib/level-up.ts, and taking the money is a
-- payment processor's job and nobody else's.
--
-- ---------------------------------------------------------------------------
-- Why the entitlement lives here and not in the app
-- ---------------------------------------------------------------------------
--
-- Every perk below is a limit the database already enforces in a trigger. That
-- is the whole reason this design is safe: Level Up does not add a new code
-- path that has to remember to check anything, it changes a number that four
-- existing checks already read. A player who forges a request, calls PostgREST
-- directly, or edits the page in their browser gets exactly the limits their
-- row in this table says they get, because the limit is applied where the row
-- is written rather than where the button is drawn.
--
-- ---------------------------------------------------------------------------
-- Nobody can grant themselves anything
-- ---------------------------------------------------------------------------
--
-- There is no insert, update or delete policy on this table. None. A signed-in
-- player can read their own row and nothing else — not even that somebody
-- else has one. Granting is an admin function, which is where a payment
-- processor's webhook will eventually call in once one exists. Until then the
-- owner grants by hand, which is slow and completely safe.
--
-- ---------------------------------------------------------------------------
-- What Level Up is NOT
-- ---------------------------------------------------------------------------
--
-- It is not a trust signal, and the badge must never be drawn as one. On a
-- site where teenagers hand strangers items worth months of grinding, a mark
-- that reads as "verified" or "trusted" is worth far more to a scammer than
-- to an honest trader — they would be the first to buy it. So the entitlement
-- carries no standing, no verification, and no priority in any dispute. It
-- buys room to post and nothing else, and the interface says so in those
-- words.
-- ===========================================================================
-- ===========================================================================

create table if not exists public.entitlements (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  -- One kind today. A column rather than a boolean because the second kind is
  -- always cheaper to add than to retrofit.
  kind       text not null default 'level_up' check (kind in ('level_up')),
  -- The whole subscription, in one column. No renewal state machine, no
  -- "cancelled but still active" — a period either has not ended or it has.
  -- Extending is `expires_at = greatest(now(), expires_at) + 60 days`, which
  -- is correct whether the player renews early or comes back months later.
  expires_at timestamptz not null,
  -- Where it came from, for the owner reading their own records: 'purchase',
  -- 'gift', 'refunded'. Never shown to the player.
  source     text not null default 'purchase'
             check (source in ('purchase', 'gift', 'comp', 'refunded')),
  -- The country the player said they were in when they bought. Kept because
  -- the price depends on it and a refund question a year later will ask.
  country    text check (country is null or country ~ '^[A-Z]{2}$'),
  -- The processor's own id for the payment, so one webhook delivered twice
  -- cannot extend a subscription twice. Unique, and null until a processor
  -- exists.
  payment_ref text unique,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entitlements_expiry_idx
  on public.entitlements (expires_at desc);

alter table public.entitlements enable row level security;

-- Read your own, and nothing else. Not even the existence of anybody else's:
-- who pays for what is not a fact this site publishes, and a list of paying
-- accounts is a list of accounts worth targeting.
--
-- The owner is not carved out here, and that is on purpose twice over. This
-- block runs before public.is_admin() is defined — a policy expression is
-- parsed when the policy is created, so naming it here would abort the whole
-- script — and it is not needed: admin_level_ups() below is security definer,
-- so it reads the table without consulting this policy at all. One route in
-- for the owner, through a function that checks the allowlist, rather than two.
drop policy if exists entitlements_read_own on public.entitlements;
create policy entitlements_read_own on public.entitlements for select
  using (user_id = auth.uid());

-- No insert, update or delete policy. Deliberate, and the single most
-- important line in this block: without one, RLS denies every write from
-- every client no matter what the app sends. The admin functions below are
-- security definer and are the only way a row is ever written.


-- ---------------------------------------------------------------------------
-- Is this person on Level Up right now?
--
-- Takes the user id rather than reading auth.uid(), because the listing-limit
-- trigger runs against new.user_id and must answer for the row being written
-- rather than for whoever happens to be connected. It is called inside
-- security definer triggers, so it is marked stable and pins its search_path.
-- ---------------------------------------------------------------------------
create or replace function mintplaza.is_level_up(p_user uuid)
returns boolean language sql stable security definer
set search_path = public, pg_catalog as $$
  select exists (
    select 1 from public.entitlements e
     where e.user_id = p_user
       and e.kind = 'level_up'
       and e.source <> 'refunded'
       and e.expires_at > now()
  );
$$;

revoke all on function mintplaza.is_level_up(uuid) from public, anon;
grant execute on function mintplaza.is_level_up(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- The four limits, per player.
--
-- The free numbers stay exactly where they were, in the immutable functions
-- near the top of this file, and these read them. That keeps one place to
-- change the free tier and one place to change what paying adds, rather than
-- two numbers that drift apart.
--
-- The multipliers are deliberately modest. A subscription that made a free
-- account unusable would be a worse site that happens to earn money; these
-- give an active trader room to work without burying anybody.
-- ---------------------------------------------------------------------------
create or replace function mintplaza.listings_per_window_for(p_user uuid)
returns int language sql stable security definer
set search_path = public, pg_catalog as $$
  select case when mintplaza.is_level_up(p_user)
              then 10 else mintplaza.listings_per_window() end;
$$;

-- How long a slot takes to come back, per player. This is the second half of
-- the rate limit and it is a perk in its own right: free accounts refill four
-- slots on a 24-hour window, Level Up refills ten on a 12-hour one.
--
-- Both halves have to move together. Ten listings per window against a
-- 24-hour window would be ten a day, which is a smaller rise than it looks
-- once a paid listing lives three days; ten against twelve hours is twenty a
-- day, which is the number the upgrade page sells.
create or replace function mintplaza.listing_window_for(p_user uuid)
returns interval language sql stable security definer
set search_path = public, pg_catalog as $$
  select case when mintplaza.is_level_up(p_user)
              then interval '12 hours' else mintplaza.listing_window() end;
$$;

create or replace function mintplaza.max_active_per_game_for(p_user uuid)
returns int language sql stable security definer
set search_path = public, pg_catalog as $$
  select case when mintplaza.is_level_up(p_user)
              then 10 else mintplaza.max_active_per_game() end;
$$;

create or replace function mintplaza.listing_lifetime_for(p_user uuid)
returns interval language sql stable security definer
set search_path = public, pg_catalog as $$
  select case when mintplaza.is_level_up(p_user)
              then interval '3 days' else mintplaza.listing_lifetime() end;
$$;

-- Bumping is NOT a Level Up perk, and that is a decision rather than an
-- omission.
--
-- The board sorts on bumped_at, so a paid bump is the one perk that takes
-- something from everybody else: it pushes free listings down. Selling that
-- turns the board into a pay-to-be-seen ladder, which is the failure mode of
-- every marketplace that has ever done it.
--
-- The number also had to change for a different reason. Free listings now live
-- 24 hours, and the old cooldown was 24 hours — so a free listing expired at
-- the exact moment it first became bumpable, and the feature did nothing for
-- anybody who had not paid. Six hours is meaningful against a one-day listing
-- and the same for everyone.
create or replace function mintplaza.bumps_per_day_for(p_user uuid)
returns int language sql stable security definer
set search_path = public, pg_catalog as $$
  select 4;   -- one every six hours, free and paid alike
$$;

revoke all on function mintplaza.listings_per_window_for(uuid) from public, anon;
revoke all on function mintplaza.listing_window_for(uuid)      from public, anon;
revoke all on function mintplaza.max_active_per_game_for(uuid) from public, anon;
revoke all on function mintplaza.listing_lifetime_for(uuid)    from public, anon;
revoke all on function mintplaza.bumps_per_day_for(uuid)       from public, anon;
grant execute on function mintplaza.listings_per_window_for(uuid) to authenticated;
grant execute on function mintplaza.listing_window_for(uuid)      to authenticated;
grant execute on function mintplaza.max_active_per_game_for(uuid) to authenticated;
grant execute on function mintplaza.listing_lifetime_for(uuid)    to authenticated;
grant execute on function mintplaza.bumps_per_day_for(uuid)       to authenticated;


-- ===========================================================================
-- ===========================================================================
-- Agreeing to the terms
--
-- ---------------------------------------------------------------------------
-- Why a table rather than a link in the footer
-- ---------------------------------------------------------------------------
--
-- "By using this site you agree to our terms" at the bottom of a page is
-- called browsewrap, and it is close to worthless: nobody has seen it, nobody
-- has done anything to accept it, and there is no record that they did. If a
-- dispute ever turns on whether somebody agreed not to scam people, the honest
-- answer would be "we hoped they read the footer".
--
-- A tick box that must be ticked before the site can be used, recorded against
-- the exact version of the text that was on screen, is a different thing
-- entirely. It is the difference between claiming somebody agreed and being
-- able to say when, and to what.
--
-- ---------------------------------------------------------------------------
-- Why the version is stored rather than a boolean
-- ---------------------------------------------------------------------------
--
-- Terms change. A single `accepted_terms` flag means a player who agreed to
-- the first version is recorded as having agreed to every later one, including
-- clauses written after they stopped reading. Storing the version means
-- raising TERMS_VERSION asks everybody again, and the record says precisely
-- which text each person saw.
-- ===========================================================================
-- ===========================================================================

create table if not exists public.terms_acceptance (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  -- The TERMS_VERSION string from src/lib/legal.ts, e.g. '2026-09-18'.
  version     text not null check (char_length(version) between 1 and 40),
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);

create index if not exists terms_acceptance_user_idx
  on public.terms_acceptance (user_id, accepted_at desc);

alter table public.terms_acceptance enable row level security;

-- Read your own. Nobody needs to see anybody else's, and a list of who has not
-- accepted yet is not a fact this site publishes.
drop policy if exists terms_read_own on public.terms_acceptance;
create policy terms_read_own on public.terms_acceptance for select
  using (user_id = auth.uid());

-- No insert policy, deliberately. A client that could write this row directly
-- could also write one for a version it never displayed — recording consent to
-- text the person never saw, which is worse than having no record at all. The
-- function below is the only writer, and it stamps the time itself.
--
-- No update or delete policy either: an acceptance is a historical fact, and a
-- fact somebody can quietly erase afterwards is not evidence of anything.

create or replace function public.accept_terms(p_version text)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;
  if p_version is null or btrim(p_version) = '' then
    raise exception 'No version given.' using errcode = 'P0001';
  end if;

  -- on conflict do nothing, not do update: the timestamp records when somebody
  -- FIRST agreed to this version. Refreshing the page should not quietly move
  -- the date on a record whose whole purpose is to say when.
  insert into public.terms_acceptance (user_id, version)
  values (auth.uid(), btrim(p_version))
  on conflict (user_id, version) do nothing;
end $$;

-- Has this player accepted the version currently being served?
--
-- The version is passed in by the application rather than stored in the
-- database, so there is one source of truth for what the current terms are —
-- the file the pages are rendered from. A copy in the database would be a
-- second one, and the two would disagree the first time somebody edited only
-- the file.
create or replace function public.has_accepted_terms(p_version text)
returns boolean language sql stable security definer
set search_path = public, pg_catalog as $$
  select exists (
    select 1 from public.terms_acceptance
     where user_id = auth.uid() and version = btrim(p_version)
  );
$$;

-- ---------------------------------------------------------------------------
-- Has this player ever agreed to anything?
--
-- Deliberately version-agnostic, and that split is the design:
--
--   The DATABASE asks "have you ever agreed?" — it is the floor, and it is
--   what stops somebody who navigated around the consent screen from posting
--   or messaging at all. It does not need to know which version is current,
--   which keeps the one source of truth for that in src/lib/legal.ts rather
--   than duplicated into a table that would drift from it.
--
--   The APPLICATION asks "have you agreed to the CURRENT version?" — it is
--   the prompt, and it is what re-asks everybody when the terms change.
--
-- Someone who agreed to last year's terms and has not seen this year's can
-- still use the site and will be asked on their next visit. Someone who has
-- agreed to nothing at all cannot do anything that creates an obligation.
-- ---------------------------------------------------------------------------
create or replace function mintplaza.has_agreed(p_user uuid)
returns boolean language sql stable security definer
set search_path = public, pg_catalog as $$
  select exists (select 1 from public.terms_acceptance where user_id = p_user);
$$;

-- anon as well as authenticated, for the same reason is_participant() is.
-- This is read inside the messages_send policy, and a policy expression is
-- evaluated as whoever is querying — so a role without EXECUTE turns what
-- should be a clean refusal into "permission denied for function", which is a
-- hard error on a path that should simply have said no. It answers from a
-- user id that is null for anon, so to a signed-out visitor it is a function
-- that returns false and discloses nothing.
--
-- The mechanical check in scripts/pg-rls-test.sql found this one, which is
-- exactly the bug it was written for after the same mistake made the whole
-- messaging feature unreadable.
revoke all on function mintplaza.has_agreed(uuid) from public;
grant execute on function mintplaza.has_agreed(uuid) to anon, authenticated;

revoke all on function public.accept_terms(text)       from public, anon;
revoke all on function public.has_accepted_terms(text) from public, anon;
grant execute on function public.accept_terms(text)       to authenticated;
grant execute on function public.has_accepted_terms(text) to authenticated;


-- ===========================================================================
-- Trade listings
-- ===========================================================================

create table if not exists public.trade_listings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  game_slug    text not null references public.games(slug) on delete cascade,
  note         text check (char_length(note) <= 500),
  status       text not null default 'active'
               check (status in ('active', 'completed', 'cancelled', 'expired', 'removed')),
  -- Always the database's own clock. The client is never asked what time it is.
  created_at   timestamptz not null default now(),
  -- This default is never the lifetime a listing actually gets, and it is a
  -- backstop rather than a rule: enforce_listing_limits() overwrites
  -- expires_at on every insert with mintplaza.listing_lifetime_for(), which is
  -- 24 hours free and 3 days with Level Up. It survives only so a row inserted
  -- by some future path that bypasses the trigger still expires eventually
  -- instead of living forever.
  --
  -- It was also quoted as the rule by two screens, which told players their
  -- listings would last a week. If you are reading this to find out how long a
  -- listing lives, the answer is listing_lifetime_for().
  expires_at   timestamptz not null default now() + interval '7 days',
  -- A free "still available" refresh that moves the listing up without
  -- consuming a slot, so nobody has to repost to stay visible. How often is
  -- mintplaza.bumps_per_day_for() — four a day, the same free and paid.
  bumped_at    timestamptz not null default now(),
  completed_at timestamptz,
  updated_at   timestamptz not null default now()
);

create index if not exists listings_browse_idx
  on public.trade_listings (game_slug, bumped_at desc) where status = 'active';
create index if not exists listings_user_window_idx
  on public.trade_listings (user_id, created_at desc);
create index if not exists listings_expiry_idx
  on public.trade_listings (expires_at) where status = 'active';

create table if not exists public.listing_sides (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.trade_listings(id) on delete cascade,
  side        text not null check (side in ('offer', 'want')),
  item_id     uuid references public.game_items(id) on delete set null,
  custom_name text,
  quantity    int not null default 1 check (quantity between 1 and 9999),
  attributes  jsonb not null default '{}',
  constraint listing_side_needs_an_item check (item_id is not null or custom_name is not null)
);

-- The index matching depends on: find listings offering item X, or wanting it.
create index if not exists listing_sides_match_idx on public.listing_sides (item_id, side);
create index if not exists listing_sides_listing_idx on public.listing_sides (listing_id);


-- ---------------------------------------------------------------------------
-- The listing limit
--
-- A true rolling window: count listings CREATED in the trailing window.
-- Counting creations rather than live listings is deliberate — it means
-- cancelling a listing does not hand back a slot, so create/cancel/create
-- cannot cycle past the limit.
--
-- Rolling rather than a bucket that empties at midnight, and that is the whole
-- reason it survives contact with somebody trying to beat it. A fixed daily
-- reset can be straddled: four listings at 23:59 and four more at 00:01 is
-- eight in two minutes, every night, entirely within the rules. A rolling
-- window has no edge to stand on — each slot comes back exactly a window after
-- the listing that spent it, so four a day means four in any day you pick.
-- ---------------------------------------------------------------------------

-- Both the cap and the window depend on who is asking: Level Up raises one and
-- shortens the other. Each is bound once in `cap` rather than called four
-- times — a mismatch there would report a slot free while the trigger refused
-- to use it, which is the most annoying bug this screen could possibly have.
--
-- Dropped rather than replaced because the returned row gained a column, and
-- Postgres will not let `create or replace` change a function's return type.
drop function if exists public.listing_allowance(text);

create or replace function public.listing_allowance(p_game text)
returns table (
  used           int,
  remaining      int,
  next_slot_at   timestamptz,
  active_in_game int,
  active_cap     int,
  -- The window this player is actually on, so a screen can say "slots free up
  -- 24 hours after posting" without guessing which tier the reader is. It was
  -- a constant in the page bundle, and a constant cannot know that the person
  -- reading it pays for a 12-hour one.
  window_hours   int
)
language sql stable security definer set search_path = public, pg_catalog as $$
  with me as (select auth.uid() as uid),
  cap as (
    select mintplaza.listings_per_window_for((select uid from me)) as per_window,
           mintplaza.max_active_per_game_for((select uid from me)) as per_game,
           mintplaza.listing_window_for((select uid from me))      as win
  ),
  recent as (
    select created_at
    from public.trade_listings
    where user_id = (select uid from me)
      and created_at > now() - (select win from cap)
    order by created_at desc
    limit (select per_window from cap)
  ),
  live as (
    -- status = 'active' AND not yet expired, because those are two different
    -- facts and only one of them is kept up to date. expire_listings() is the
    -- job that turns an elapsed listing into status='expired', and nothing
    -- schedules it — so a listing whose day is up sits here as 'active'
    -- forever. Filtering on the timestamp as well means this number is right
    -- whether or not the sweeper ever runs, which is the only way a count a
    -- player is blocked by should ever be computed.
    select count(*)::int as n
    from public.trade_listings
    where user_id = (select uid from me)
      and game_slug = p_game
      and status = 'active' and expires_at > now()
  )
  select
    (select count(*)::int from recent),
    greatest((select per_window from cap) - (select count(*)::int from recent), 0),
    case
      when (select count(*) from recent) >= (select per_window from cap)
      then (select min(created_at) from recent) + (select win from cap)
      else null
    end,
    (select n from live),
    (select per_game from cap),
    (select (extract(epoch from win) / 3600)::int from cap);
$$;

-- Enforced as a BEFORE INSERT trigger so every path hits it: the app, a direct
-- PostgREST call, psql, anything. The row lock on the profile serialises two
-- browser tabs submitting at the same moment.
create or replace function public.enforce_listing_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_recent int;
  v_active int;
  v_next   timestamptz;
  -- Read ONCE, from new.user_id rather than auth.uid(), and held for the rest
  -- of the function. Two reasons, and both are the kind of bug that only shows
  -- up in production:
  --
  --   The row being written is the authority on whose limits apply. A listing
  --   inserted by any route other than a signed-in browser — a future webhook,
  --   a repair script — would otherwise be checked against whoever happened to
  --   be connected, or against nobody at all.
  --
  --   And a subscription that expires in the microseconds between the count
  --   check and the message would report one cap while enforcing another.
  v_per_window int := mintplaza.listings_per_window_for(new.user_id);
  v_per_game   int := mintplaza.max_active_per_game_for(new.user_id);
  -- Read from the same row and held for the same reasons. The window is a
  -- Level Up perk too, so it must not be re-read between the count and the
  -- message: a subscription that lapses in between would count against a
  -- 12-hour window and then quote a 24-hour one.
  v_window     interval := mintplaza.listing_window_for(new.user_id);
  -- Derived from v_window rather than by calling the function a second time,
  -- which is the whole point: one read, one truth, no way for the two to
  -- disagree. PL/pgSQL initialises declarations in order, so v_window is
  -- already set here.
  v_hours      int      := (extract(epoch from v_window) / 3600)::int;
begin
  perform 1 from public.profiles where id = new.user_id for update;

  -- Agreeing to the rules comes before publishing anything under them. See the
  -- note on mintplaza.has_agreed().
  if not mintplaza.has_agreed(new.user_id) then
    raise exception 'Agree to the terms before posting.'
      using errcode = 'P0001',
            hint = 'The box appears the next time you open MintPlaza.';
  end if;

  select count(*) into v_recent
  from public.trade_listings
  where user_id = new.user_id
    and created_at > now() - v_window;

  if v_recent >= v_per_window then
    select min(created_at) + v_window into v_next
    from (
      select created_at from public.trade_listings
      where user_id = new.user_id and created_at > now() - v_window
      order by created_at desc limit v_per_window
    ) w;
    raise exception using
      errcode = 'P0001',
      message = format('All %s of your listings for the next %s hours are posted.',
                       v_per_window, v_hours),
      detail  = format('next_slot_at=%s', v_next),
      hint    = format('A slot comes back %s hours after the listing that used it.', v_hours);
  end if;

  -- The same two facts as in listing_allowance() above, and this is the half
  -- that refuses the post rather than just drawing a number.
  --
  -- Without `expires_at > now()` a player who used all four of their per-game
  -- slots was locked out of that game permanently: the next day the rolling
  -- window handed all four posting slots back, the meter said "4 of 4
  -- available", and this count still saw four 'active' rows that had expired
  -- hours earlier and were already invisible on the board. Reproduced against
  -- a real Postgres before this line existed.
  select count(*) into v_active
  from public.trade_listings
  where user_id = new.user_id and game_slug = new.game_slug
    and status = 'active' and expires_at > now();

  if v_active >= v_per_game then
    raise exception using
      errcode = 'P0001',
      message = format('You already have %s active listings in this game.', v_per_game),
      hint    = 'Complete or cancel one before posting another.';
  end if;

  -- Server owns every timestamp on the row.
  new.created_at := now();
  new.bumped_at  := now();
  new.expires_at := now() + mintplaza.listing_lifetime_for(new.user_id);
  new.status     := 'active';
  return new;
end $$;

drop trigger if exists trade_listings_enforce_limits on public.trade_listings;
create trigger trade_listings_enforce_limits
  before insert on public.trade_listings
  for each row execute function public.enforce_listing_limits();

-- Bumping, and only by the listing's owner.
--
-- A bump is a cooldown rather than a counter: 24 hours divided by however many
-- bumps a day that player gets. That is four for everybody, paid or not, so
-- the cooldown is six hours — see bumps_per_day_for() above for why this is
-- not a perk.
--
-- (This comment used to say free was one every 24 hours and Level Up one every
-- 8. That was the earlier design and it had a hole: a free listing lived 24
-- hours, so it expired at the exact moment it first became bumpable.)
--
-- A cooldown needs no daily reset job, cannot be gamed across a midnight
-- boundary, and — the part that matters on a board sorted by bumped_at —
-- spreads bumps through the day instead of letting them fire in a row.
create or replace function public.bump_listing(p_listing uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_new      timestamptz;
  v_cooldown interval := interval '24 hours'
                         / greatest(mintplaza.bumps_per_day_for(auth.uid()), 1);
begin
  update public.trade_listings
     set bumped_at = now(), updated_at = now()
   where id = p_listing
     and user_id = auth.uid()
     and status = 'active'
     and bumped_at < now() - v_cooldown
  returning bumped_at into v_new;

  if v_new is null then
    raise exception 'This listing cannot be bumped yet.'
      using errcode = 'P0001',
            hint = format('Bumps are one every %s.', v_cooldown);
  end if;
  return v_new;
end $$;

-- Run from a scheduled job (pg_cron, or a Supabase scheduled function).
create or replace function public.expire_listings()
returns int language sql security definer set search_path = public as $$
  with done as (
    update public.trade_listings
       set status = 'expired', updated_at = now()
     where status = 'active' and expires_at <= now()
    returning 1
  )
  select count(*)::int from done;
$$;


-- ===========================================================================
-- Messaging
-- ===========================================================================

create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid references public.trade_listings(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz,
  primary key (conversation_id, user_id)
);

create index if not exists participants_user_idx on public.conversation_participants (user_id);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 2000),
  created_at      timestamptz not null default now(),
  edited_at       timestamptz,
  status          text not null default 'visible'
                  check (status in ('visible', 'hidden', 'removed'))
);

create index if not exists messages_thread_idx on public.messages (conversation_id, created_at desc);

-- Are these two in the same conversation?
--
-- It lives in `mintplaza` rather than `public` for a specific reason. Every
-- messaging policy below calls it, and a policy expression is evaluated as
-- whoever is querying — so the querying role must hold EXECUTE on it or the
-- read raises "permission denied for function" instead of returning no rows.
-- That is a hard error on a page that should simply have been empty, and it
-- made public.messages unreadable by everybody, signed in or not.
--
-- Granting it in `public` would have fixed the error and opened a probe: it
-- takes an arbitrary conversation and an arbitrary user, so anyone could ask
-- whether two strangers share a thread. The mintplaza schema is not in
-- Supabase's exposed list, so PostgREST will not serve it as an RPC, while
-- policies can still call it.
--
-- SECURITY DEFINER is load-bearing and not a convenience: conversation_
-- participants has RLS whose own policy calls this function, so reading the
-- table as the caller would recurse forever.
create or replace function mintplaza.is_participant(p_conversation uuid, p_user uuid)
returns boolean language sql stable security definer
set search_path = public, pg_catalog as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation and user_id = p_user
  );
$$;

revoke all on function mintplaza.is_participant(uuid, uuid) from public;
grant execute on function mintplaza.is_participant(uuid, uuid) to anon, authenticated;


-- ===========================================================================
-- Safety
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- There is no blocking on MintPlaza, and that is a deliberate product call.
--
-- The obvious argument for blocking is harassment, and it is a real argument.
-- The argument against it, on THIS site specifically, is stronger: a scammer's
-- last move is to block the person they just took an item from. That buries
-- the conversation, ends the confrontation, and leaves the victim with nothing
-- to point at. Blocking hands the tool to whoever uses it first, and on a
-- trading board that is nearly always the person in the wrong.
--
-- So the lever is reporting, not blocking. A report goes to the owner's queue
-- with the message attached, and the owner can set a profile's status to
-- 'restricted' or 'suspended' — which the messages_send policy already checks,
-- so a suspended account cannot send to ANYBODY rather than just to the one
-- person who blocked them. That is the correct shape: dealing with someone
-- behaving badly should protect every future victim, not only the one who
-- happened to press the button.
--
-- The table is dropped rather than left empty. An unused table with a policy
-- on it is an invitation to wire it back in without re-reading why it went.
-- ---------------------------------------------------------------------------
do $$
declare v_rows bigint;
begin
  if to_regclass('public.blocks') is not null then
    execute 'select count(*) from public.blocks' into v_rows;
    if v_rows > 0 then
      raise notice 'Dropping the blocks table and its % row(s). Reporting replaces it.', v_rows;
    end if;
    drop table public.blocks cascade;
  end if;
end $$;

create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references public.profiles(id) on delete cascade,
  subject_type  text not null check (subject_type in ('user', 'listing', 'message', 'proof')),
  subject_id    uuid not null,
  reason        text not null,
  detail        text check (char_length(detail) <= 1000),
  status        text not null default 'open'
                check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index if not exists reports_queue_idx on public.reports (status, created_at);
-- One open report per person per subject, so reporting cannot be used to flood.
create unique index if not exists reports_one_open_per_subject
  on public.reports (reporter_id, subject_type, subject_id) where status = 'open';

create table if not exists public.moderation_actions (
  id          uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles(id) on delete set null,
  action      text not null,
  subject_type text not null,
  subject_id  uuid not null,
  reason      text,
  created_at  timestamptz not null default now()
);

create table if not exists public.audit_log (
  id         bigserial primary key,
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  subject    text,
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

-- Moderators are marked in app_metadata, which users cannot write to.
--
-- SECURITY DEFINER because this is read from inside row-level security
-- policies, so it is evaluated as whoever is querying. Left as INVOKER it
-- needs every caller to hold USAGE on the auth schema and EXECUTE on
-- auth.jwt(), and a policy that raises "permission denied for schema auth"
-- instead of returning false fails a read that should simply have been empty.
-- It is not a privilege escalation: auth.jwt() reads a session setting, so it
-- returns the caller's own claims either way.
create or replace function public.is_moderator()
returns boolean language sql stable security definer as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('moderator', 'admin'),
    false
  );
$$;


-- ===========================================================================
-- Matching
--
-- There is no ranking function here on purpose, and the one that used to be
-- was removed rather than left to rot. It scored listings by set intersection
-- alone, which cannot answer the question a trader is actually asking: a
-- reciprocal match that hands over a Mythical for a Common scored exactly the
-- same as a fair one, because nothing in SQL knows what anything is worth.
--
-- Values live in values.ts, where the proof script can check them and one edit
-- changes both the calculator and the ranker. Copying them into Postgres to
-- let a SQL ranker read them would give the site two sources of truth for the
-- single number players argue about, and guarantee they drift.
--
-- So the work is split where each side is strong: SQL narrows, TypeScript
-- ranks. trade_match_candidates() below returns the listings that touch a
-- player's lists at all — an indexed set intersection, which is exactly what a
-- database is for — and src/lib/match.ts decides what those are worth to them.
-- ===========================================================================

-- ===========================================================================
-- Row level security
--
-- Default deny. Every table gets RLS, and reads are scoped to what a person is
-- actually entitled to see.
-- ===========================================================================

alter table public.profiles                enable row level security;
alter table public.games                   enable row level security;
alter table public.game_items              enable row level security;
alter table public.inventory_entries       enable row level security;
alter table public.inventory_proofs        enable row level security;
alter table public.trade_listings          enable row level security;
alter table public.listing_sides           enable row level security;
alter table public.conversations           enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                enable row level security;
alter table public.reports                 enable row level security;
alter table public.moderation_actions      enable row level security;
alter table public.audit_log               enable row level security;

-- Profiles: public read, self write.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Reference data: readable by anyone, writable only by moderators.
drop policy if exists games_read on public.games;
create policy games_read on public.games for select using (is_active or public.is_moderator());
drop policy if exists games_write on public.games;
create policy games_write on public.games for all
  using (public.is_moderator()) with check (public.is_moderator());

drop policy if exists items_read on public.game_items;
create policy items_read on public.game_items for select using (is_active or public.is_moderator());
drop policy if exists items_write on public.game_items;
create policy items_write on public.game_items for all
  using (public.is_moderator()) with check (public.is_moderator());

-- Inventory: yours alone. It drives matching, which runs server-side, so it
-- never needs to be world-readable.
drop policy if exists inventory_own on public.inventory_entries;
create policy inventory_own on public.inventory_entries for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists proofs_own on public.inventory_proofs;
create policy proofs_own on public.inventory_proofs for all
  using (exists (select 1 from public.inventory_entries e
                 where e.id = entry_id and e.user_id = auth.uid()))
  with check (exists (select 1 from public.inventory_entries e
                      where e.id = entry_id and e.user_id = auth.uid()));

-- Listings: active ones are public; you write only your own. No DELETE policy
-- anywhere — listings are cancelled, never removed, or the rolling window
-- could be gamed by deleting rows.
drop policy if exists listings_read on public.trade_listings;
create policy listings_read on public.trade_listings for select
  using (
    (status = 'active' and expires_at > now())
    or user_id = auth.uid()
    or public.is_moderator()
  );
drop policy if exists listings_insert_own on public.trade_listings;
create policy listings_insert_own on public.trade_listings for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
  );
drop policy if exists listings_update_own on public.trade_listings;
create policy listings_update_own on public.trade_listings for update
  using (user_id = auth.uid() or public.is_moderator())
  with check (user_id = auth.uid() or public.is_moderator());

drop policy if exists sides_read on public.listing_sides;
create policy sides_read on public.listing_sides for select
  using (exists (select 1 from public.trade_listings l where l.id = listing_id));
drop policy if exists sides_write_own on public.listing_sides;
create policy sides_write_own on public.listing_sides for all
  using (exists (select 1 from public.trade_listings l
                 where l.id = listing_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.trade_listings l
                      where l.id = listing_id and l.user_id = auth.uid()));

-- Messaging: participants only, both directions.
drop policy if exists conversations_read on public.conversations;
create policy conversations_read on public.conversations for select
  using (mintplaza.is_participant(id, auth.uid()) or public.is_moderator());

drop policy if exists participants_read on public.conversation_participants;
create policy participants_read on public.conversation_participants for select
  using (mintplaza.is_participant(conversation_id, auth.uid()) or public.is_moderator());

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select
  using (
    (status = 'visible' and mintplaza.is_participant(conversation_id, auth.uid()))
    or public.is_moderator()
  );
drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages for insert
  with check (
    sender_id = auth.uid()
    and mintplaza.is_participant(conversation_id, auth.uid())
    -- The account must be in good standing. With no blocking on this site,
    -- THIS is the lever that stops somebody: the owner sets a profile to
    -- 'restricted' or 'suspended' from a report, and that silences them
    -- everywhere at once rather than only towards whoever complained.
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
    -- And they must have agreed to the rules at some point. The consent screen
    -- covers the main surface, but /messages is its own route and a determined
    -- account could reach it without passing through — which is precisely what
    -- somebody would do to be able to say later that they never agreed not to
    -- scam anybody. Enforced here, where navigating around it is not possible.
    and mintplaza.has_agreed(auth.uid())
  );

-- No blocks policy, because there is no blocks table. See the note above the
-- teardown near the top of this file.

-- Reports: file your own, read your own. The queue is moderator-only.
drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports for insert
  with check (reporter_id = auth.uid());
drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select
  using (reporter_id = auth.uid() or public.is_moderator());
drop policy if exists reports_moderate on public.reports;
create policy reports_moderate on public.reports for update
  using (public.is_moderator()) with check (public.is_moderator());

-- Moderation records and the audit log are never client-readable.
drop policy if exists moderation_read on public.moderation_actions;
create policy moderation_read on public.moderation_actions for select
  using (public.is_moderator());
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select using (public.is_moderator());


-- ===========================================================================
-- updated_at
-- ===========================================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','inventory_entries','trade_listings'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;


-- ===========================================================================
-- Seed: the six launch games
--
-- Configuration, not user content. Everything here is editable later without
-- a code change, which matters because these games change constantly.
-- ===========================================================================

insert into public.games (slug, name, short_name, blurb, modules, activity_kinds, item_categories, hue, art, sort_order) values
  ('blox-fruits', 'Blox Fruits', 'Blox Fruits',
   'Raid teams, sea hunts and fruit trades — the things that need more players than you have friends online.',
   '{trades,inventory,activities,help}',
   '{Raid,"Sea event","Boss hunt","Race awakening","Grind session"}',
   '{Fruit,Skin,Gamepass,Scroll}',
   '#D9542B', '/games/blox-fruits.jpg', 1),

  ('adopt-me', 'Adopt Me!', 'Adopt Me',
   'Pet trades where Neon and Fly/Ride decide the value, and people to run a live event alongside.',
   '{trades,inventory,help,activities}',
   '{"Neon project","Mega project","Aging help","Task run",Event}',
   '{Pet,Toy,Vehicle,Food,Stroller,Egg,Furniture,Potion}',
   '#E8B23A', '/games/adopt-me.jpg', 3),

  ('pet-simulator-99', 'Pet Simulator 99', 'PS99',
   'Huges, Titanics and enchants — the biggest catalogue on MintPlaza, straight from the game''s own published data.',
   '{trades,inventory,help,activities}',
   '{Clan,Event,"Group session"}',
   '{Pet,Egg,Item,Booth,Hoverboard,Lootbox,Enchant,Card,Boost,Charm,Rod,Shovel,Ultimate,Huge,Fruit,Potion,Seed,Titanic,"Watering Can",Sprinkler}',
   '#D9538F', '/games/pet-simulator-99.jpg', 4),

  ('creatures-of-sonaria', 'Creatures of Sonaria', 'Sonaria',
   'Creatures, palettes and plushies traded in the Trade Realm, where the top of the market is genuinely unpriced and we say so.',
   '{trades,inventory,activities,help}',
   '{"Pack mission","Daily mission","Weekly mission","Monthly mission","Event mission"}',
   '{Creature,Material,Palette,Plushie}',
   '#4E8FB5', '/games/creatures-of-sonaria.jpg', 6)
on conflict (slug) do update set
  name = excluded.name, short_name = excluded.short_name, blurb = excluded.blurb,
  modules = excluded.modules, activity_kinds = excluded.activity_kinds,
  item_categories = excluded.item_categories, hue = excluded.hue,
  art = excluded.art, sort_order = excluded.sort_order;

-- Games that were in an earlier draft and are not launch games. They stay
-- removed, and this is the only place that decides which.
--
--   murder-mystery-2  was never a launch game; it was a drafting mistake.
--   royale-high       was researched and dropped: 26 items and no value list,
--                     which is a trading screen that cannot answer the one
--                     question a trader asks.
--
-- games.slug is the parent of seven ON DELETE CASCADE foreign keys, so one
-- line here can take catalogue rows, holdings, listings, posts and templates
-- with it. On a new project there is nothing to take. On a database that has
-- been live, the counts are printed BEFORE the delete rather than discovered
-- afterwards — a silent cascade is exactly the data loss nobody notices until
-- somebody asks where their inventory went.
do $$
declare
  g text;
  v_items int; v_inv int; v_listings int; v_posts int; v_templates int;
begin
  foreach g in array array['murder-mystery-2', 'royale-high', 'grow-a-garden'] loop
    if not exists (select 1 from public.games where slug = g) then
      continue;
    end if;

    select count(*) into v_items     from public.game_items        where game_slug = g;
    select count(*) into v_inv       from public.inventory_entries where game_slug = g;
    select count(*) into v_listings  from public.trade_listings    where game_slug = g;
    select count(*) into v_posts     from public.service_listings  where game_slug = g;
    select count(*) into v_templates from public.service_templates where game_slug = g;

    raise notice 'Removing %, and with it: % catalogue items, % holdings, % trade listings, % board posts, % templates.',
      g, v_items, v_inv, v_listings, v_posts, v_templates;

    delete from public.games where slug = g;
  end loop;
end $$;


-- ===========================================================================
-- Function hardening
--
-- Added after Supabase's own database linter flagged two real problems on the
-- live project:
--
--   Every SECURITY DEFINER function was callable by `anon` over the REST API.
--   expire_listings() in particular would have let anyone expire the board.
--
--   Several functions had a mutable search_path, which lets a caller shadow
--   the objects a SECURITY DEFINER function resolves — a privilege escalation
--   route.
--
-- listing_allowance also took an arbitrary user id, so any signed-in player
-- could read anyone else's slot usage. It now reports on the caller only.
-- ===========================================================================

alter function mintplaza.listing_window()      set search_path = pg_catalog;
alter function mintplaza.listings_per_window() set search_path = pg_catalog;
alter function mintplaza.max_active_per_game() set search_path = pg_catalog;
alter function mintplaza.listing_lifetime()    set search_path = pg_catalog;
alter function public.is_moderator()           set search_path = public, pg_catalog;
alter function public.touch_updated_at()       set search_path = public, pg_catalog;

revoke all on function public.ensure_profile()          from public, anon, authenticated;
revoke all on function public.bump_listing(uuid)        from public, anon, authenticated;
revoke all on function public.listing_allowance(text)   from public, anon, authenticated;
revoke all on function public.expire_listings()         from public, anon, authenticated;
revoke all on function public.handle_new_user()         from public, anon, authenticated;
revoke all on function public.enforce_listing_limits()  from public, anon, authenticated;

grant execute on function public.ensure_profile()        to authenticated;
grant execute on function public.bump_listing(uuid)      to authenticated;
grant execute on function public.listing_allowance(text) to authenticated;

-- expire_listings is a scheduled job and handle_new_user and
-- enforce_listing_limits are trigger bodies. None should be reachable over the
-- REST API, so none of them are granted to anybody.
--
-- is_participant used to be revoked here too, on the same reasoning, and that
-- was a mistake: it is called from inside the messaging policies, which are
-- evaluated as the querying role, so revoking it turned every read of
-- messages, conversations and participants into a permission error rather than
-- an empty result. It now lives in mintplaza, where PostgREST cannot serve it
-- but a policy can still call it. See its definition above.


-- ===========================================================================
-- ===========================================================================
-- Raids & Services: the board
--
-- Applied live as migrations; kept here so the file remains the whole picture.
-- Five tables, and their shape encodes the rules rather than trusting the
-- application to remember them.
-- ===========================================================================
-- ===========================================================================

create table if not exists public.service_listings (
  id            uuid primary key default gen_random_uuid(),
  game_slug     text not null references public.games(slug) on delete cascade,
  author_id     uuid not null references public.profiles(id) on delete cascade,
  side          text not null check (side in ('offer', 'request')),
  service_ids   text[] not null check (cardinality(service_ids) between 1 and 8),
  terms_kind    text not null default 'free' check (terms_kind in ('free', 'split', 'item')),
  terms_item_id uuid references public.game_items(id) on delete set null,
  detail        text check (char_length(detail) <= 280),
  stage         text not null default 'voting' check (stage in ('voting', 'requested', 'locked')),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '2 hours',
  constraint terms_item_present check (terms_kind <> 'item' or terms_item_id is not null)
);

-- One person, one listing, one vote. The primary key is the rule.
create table if not exists public.service_votes (
  listing_id uuid not null references public.service_listings(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

-- The composite foreign key into votes is doing real work: you cannot pick
-- somebody who never put their hand up.
create table if not exists public.service_picks (
  listing_id uuid not null,
  user_id    uuid not null,
  reply      text not null default 'waiting' check (reply in ('waiting', 'agreed', 'denied')),
  picked_at  timestamptz not null default now(),
  replied_at timestamptz,
  primary key (listing_id, user_id),
  foreign key (listing_id, user_id)
    references public.service_votes(listing_id, user_id) on delete cascade
);

create table if not exists public.service_comments (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 400),
  reply_to   uuid references public.service_comments(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Presence, for the green dot. A timestamp rather than a websocket: one cheap
-- write, survives a reconnect, and "seen in the last three minutes" is what a
-- player means by online.
alter table public.profiles add column if not exists last_seen_at timestamptz;

-- Full definitions of the triggers, policies, board_listings() and the
-- two-hour cleanup are in the applied migrations:
--
--   service_listings_votes_picks_comments   tables, triggers, cleanup function
--   service_board_rls                       every policy
--   service_board_limits_and_reads          3-per-game limit, board_listings()
--   board_listings_include_voter_id         voter ids, for reporting
--   reports_use_existing_table              reuse the moderation table
--   schedule_listing_cleanup_v2             pg_cron, every 5 minutes
--   harden_board_functions                  trigger functions off the API
--
-- The rules those enforce, verified against the live database as the
-- `authenticated` role:
--
--   author cannot vote on their own listing        refused by trigger
--   a second vote from the same person             refused by primary key
--   a non-voter cannot comment                     refused by policy
--   a non-author cannot pick, delete or restage    0 rows
--   picking somebody who never voted               refused by foreign key
--   the author cannot answer for a picked player   0 rows
--   the picked player answers their own row        1 row, replied_at stamped
--   a vote cannot be withdrawn after being picked  0 rows
--   a fourth live post in one game                 refused by trigger
--   an expired listing                             invisible before deletion
--   a reporter reading reports back                0 rows

-- ---------------------------------------------------------------------------
-- Binding the owner's account to the control panel
-- ---------------------------------------------------------------------------
--
-- The allowlist is seeded with a Roblox *username*, because that is the only
-- thing a person knows about their own account before they have ever signed in.
-- A username is a poor permanent key, though: Roblox lets you change one, and
-- releases the old one for anybody to claim. So it is used exactly once.
--
-- The first sign-in whose username matches pins the numeric Roblox id, and
-- every check from then on is against that id alone. Somebody who later renames
-- themselves to the seeded username matches nothing.
create or replace function mintplaza.bind_admin_on_first_signin()
returns void language plpgsql security definer
set search_path = mintplaza, public, pg_catalog as $$
begin
  update mintplaza.admin_allowlist a
     set roblox_user_id = p.roblox_user_id,
         bound_at       = now()
    from public.profiles p
   where p.id = auth.uid()
     and a.roblox_user_id is null
     and lower(a.roblox_username) = lower(p.username);
end $$;

-- Not callable by a signed-in user directly. ensure_profile() is SECURITY
-- DEFINER and runs it as the owner, which is the only route in.
revoke all on function mintplaza.bind_admin_on_first_signin() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Your own account
-- ---------------------------------------------------------------------------

-- Appearing offline is stored on the profile, not in the browser: the green dot
-- is something *other people* see, so a per-device setting would show you
-- hidden to yourself while everybody else watched you come online.
alter table public.profiles
  add column if not exists hide_presence boolean not null default false;

-- The switch is enforced here rather than at the call site, so no future caller
-- can forget it and quietly light somebody back up.
create or replace function public.touch_presence()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid() and hide_presence = false;
end $$;
-- Supabase grants EXECUTE to anon and authenticated by default on anything
-- created in `public`, so anon has to be named: revoking from PUBLIC alone
-- leaves the account functions reachable by a signed-out visitor.
revoke all on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;

-- Going invisible clears the dot already showing, or you stay lit for the rest
-- of the presence window after asking not to be.
create or replace function public.set_hide_presence(p_hide boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set hide_presence = p_hide,
         last_seen_at  = case when p_hide then null else now() end
   where id = auth.uid();
end $$;
-- Supabase grants EXECUTE to anon and authenticated by default on anything
-- created in `public`, so anon has to be named: revoking from PUBLIC alone
-- leaves the account functions reachable by a signed-out visitor.
revoke all on function public.set_hide_presence(boolean) from public, anon;
grant execute on function public.set_hide_presence(boolean) to authenticated;

-- The Roblox username is never editable: it is the account's identity and the
-- only thing another player can verify. A display name sits beside it, and may
-- not be a name somebody else signs in under — otherwise anyone could wear a
-- trusted trader's name. The character class also blocks the zero-width tricks
-- used to build a lookalike.
create or replace function public.set_display_name(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare v_clean text := nullif(btrim(p_name), '');
begin
  if v_clean is not null then
    if length(v_clean) > 24 then raise exception 'That name is too long — 24 characters at most.'; end if;
    if length(v_clean) < 2  then raise exception 'That name is too short.'; end if;
    if v_clean !~ '^[[:alnum:] _''.\-]+$' then
      raise exception 'Letters, numbers, spaces, apostrophes, dots and dashes only.';
    end if;
    if exists (select 1 from public.profiles
                where lower(username) = lower(v_clean) and id <> auth.uid()) then
      raise exception 'Another player signs in under that name.';
    end if;
  end if;
  update public.profiles set display_name = v_clean, updated_at = now()
   where id = auth.uid();
  return v_clean;
end $$;
-- Supabase grants EXECUTE to anon and authenticated by default on anything
-- created in `public`, so anon has to be named: revoking from PUBLIC alone
-- leaves the account functions reachable by a signed-out visitor.
revoke all on function public.set_display_name(text) from public, anon;
grant execute on function public.set_display_name(text) to authenticated;

-- Leaving for good. Deleting the profile cascades to listings, votes, picks,
-- comments and contacts. The Roblox account is untouched — MintPlaza only ever
-- held a name and a picture, and this hands both back.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  delete from public.profiles where id = auth.uid();
end $$;
-- Supabase grants EXECUTE to anon and authenticated by default on anything
-- created in `public`, so anon has to be named: revoking from PUBLIC alone
-- leaves the account functions reachable by a signed-out visitor.
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;


-- ===========================================================================
-- Limits the poster sets, reports the owner can act on, per-game tab names
-- ===========================================================================

-- The clock used to be ours on every post. It should never have been: the
-- person who knows how long they will be online is the person posting, and one
-- fixed window either cuts them off early or leaves a dead post on the board.
-- Trades get none of this — one person to one person, so there is no voting to
-- cap and no team to size.
alter table public.service_listings
  add column if not exists vote_cap integer,
  add column if not exists slots    integer;

-- Through add_check because this table can already hold posts written before
-- these rules existed, and one of them must not cost the rest of the file.
-- Ten minutes is the shortest post anybody can answer in time; four hours the
-- longest that can still honestly be called live.
select mintplaza.add_check('public.service_listings', 'service_listings_vote_cap_check',
  'vote_cap is null or (vote_cap between 1 and 500)');
select mintplaza.add_check('public.service_listings', 'service_listings_slots_check',
  'slots is null or (slots between 1 and 18)');
select mintplaza.add_check('public.service_listings', 'service_listings_window_check',
  'expires_at > created_at + interval ''10 minutes''
   and expires_at <= created_at + interval ''4 hours''');

-- Voting closes at the cap. In a trigger rather than the app, because two people
-- tapping at the same moment is exactly when an app-level count is wrong, and
-- the row lock is what makes the answer true rather than usually true.
create or replace function public.enforce_vote_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cap int; v_now int;
begin
  select vote_cap into v_cap
    from public.service_listings where id = new.listing_id for update;
  if v_cap is null then return new; end if;
  select count(*) into v_now from public.service_votes where listing_id = new.listing_id;
  if v_now >= v_cap then
    raise exception 'This one is full — % % already put their hand up.',
      v_cap, case when v_cap = 1 then 'person' else 'people' end;
  end if;
  return new;
end $$;

drop trigger if exists service_votes_cap on public.service_votes;
create trigger service_votes_cap
  before insert on public.service_votes
  for each row execute function public.enforce_vote_cap();
revoke all on function public.enforce_vote_cap() from public, anon, authenticated;

-- The site tells people to record before they hand anything over. A report with
-- nowhere to put that recording throws away the only evidence there will be.
-- A link, not an upload: video is what people record, and every platform they
-- already use hands them a URL in two taps.
alter table public.reports
  add column if not exists evidence_url  text,
  add column if not exists subject_label text,
  add column if not exists reviewed_by   uuid references public.profiles(id) on delete set null,
  add column if not exists admin_note    text;

select mintplaza.add_check('public.reports', 'reports_evidence_url_check',
  'evidence_url is null
   or (length(evidence_url) <= 500 and evidence_url ~* ''^https?://'')');

-- The three boards are fixed, because the code behind each is different. What a
-- game *calls* them is content: a fishing game forced to advertise raids reads
-- as somebody else's furniture. A CHECK cannot hold a subquery, so the shape
-- test lives in an IMMUTABLE function the constraint calls — in the constraint
-- rather than only the setter, because a constraint is every write path.
alter table public.games
  add column if not exists explore_tabs jsonb not null default '[]'::jsonb;

create or replace function public.valid_explore_tabs(p jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select jsonb_typeof(p) = 'array'
     and jsonb_array_length(p) <= 6
     and not exists (
       select 1 from jsonb_array_elements(p) t
        where jsonb_typeof(t) <> 'object'
           or coalesce(t->>'id', '')    = ''
           or coalesce(t->>'label', '') = ''
           or length(t->>'label') > 40
           or coalesce(t->>'kind', '') not in ('trades', 'services', 'community')
     );
$$;

select mintplaza.add_check('public.games', 'games_explore_tabs_check',
  'public.valid_explore_tabs(explore_tabs)');

-- ===========================================================================
-- Studio: templates and pictures become data
-- ===========================================================================
--
-- Until now every list template lived in TypeScript, so the owner could change
-- what an item was worth but not what people could post about. That was the
-- wrong line: the catalogue and the templates are both content, and both change
-- when a game ships an update.
--
-- The code catalogue stays as the seed and the fallback. These rows override it
-- id by id, decided at read time, so there is no seeding step to drift out of
-- date: a template edited in the Studio gets a row and is read from there; one
-- never touched has no row and is read from code. Deleting a row reverts the
-- template rather than destroying it.

create table if not exists public.service_templates (
  id           text primary key,
  game_slug    text not null references public.games(slug) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 80),
  kind         text not null check (kind in
                 ('Raid','Trial','Puzzle','Boss','Unlock','Grind','Island','Crew','Event','Hunt')),
  section      text not null default 'services' check (section in ('services','recruit')),
  art          text,
  needs        text check (needs is null or length(needs) <= 600),
  players      integer check (players is null or players between 1 and 18),
  gives        text check (gives is null or length(gives) <= 300),
  open_ended   boolean not null default false,
  aliases      text[] not null default '{}',
  refs         jsonb  not null default '[]'::jsonb,
  verified     boolean not null default true,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles(id) on delete set null,

  -- The one rule that keeps the two boards from becoming one board. Enforced
  -- here so no edit, from the panel or otherwise, can quietly blur it.
  constraint service_templates_section_size check (
    players is null
    or (section = 'services' and players <= 3)
    or (section = 'recruit'  and players >= 3)
  )
);

create or replace function public.valid_service_refs(p jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select jsonb_typeof(p) = 'array'
     and jsonb_array_length(p) <= 12
     and not exists (
       select 1 from jsonb_array_elements(p) t
        where jsonb_typeof(t) <> 'object'
           or coalesce(t->>'id','')    = ''
           or coalesce(t->>'label','') = ''
           or length(t->>'label') > 40
     );
$$;

select mintplaza.add_check('public.service_templates', 'service_templates_refs_check',
  'public.valid_service_refs(refs)');

create index if not exists service_templates_game_idx
  on public.service_templates (game_slug, section, sort_order);

alter table public.service_templates enable row level security;
drop policy if exists service_templates_read on public.service_templates;
create policy service_templates_read on public.service_templates for select using (true);
-- No insert, update or delete policy at all. The admin functions are not
-- defence in depth on top of a policy — they are the only door.

-- One shelf of pictures for the whole site. The Angel race is uploaded once and
-- reused everywhere it appears, so re-skinning it later is one replacement.
create table if not exists public.media (
  id         uuid primary key default gen_random_uuid(),
  url        text not null check (url ~* '^(/|https?://)'),
  label      text not null check (length(btrim(label)) between 1 and 80),
  kind       text not null default 'other'
             check (kind in ('item','service','ref','game','other')),
  game_slug  text references public.games(slug) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists media_url_key on public.media (url);
alter table public.media enable row level security;
drop policy if exists media_read on public.media;
create policy media_read on public.media for select using (true);

-- Every Studio write goes through a SECURITY DEFINER function whose first act is
-- is_admin(). Supabase cannot gate an RPC beyond `authenticated`, so the gate
-- lives inside the function: a signed-in stranger reaches it and is told
-- "Not found." Verified: non-admins are refused on every path, including a
-- direct write to either table.


-- ---------------------------------------------------------------------------
-- Profiles: who a player is, what they can show for it, and what they have done
-- ---------------------------------------------------------------------------
--
-- Three ideas, and it is worth being clear about which is which, because they
-- are trusted very differently.
--
--   1. What a player SAYS about themselves — the description and the tags.
--      Free text, worth nothing as evidence, capped and sanitised because free
--      text on a site for teenagers is how a Discord invite gets in.
--
--   2. What a player SHOWS — screenshots of their in-game profile. These are
--      not proof in any cryptographic sense and the site never calls them
--      verified. A screenshot can be borrowed, edited or staged. What they are
--      worth is exactly what they are worth in a Discord trade channel: a
--      person who has posted three pictures of the account they trade on has
--      staked something, and one who has posted none has not. The interface
--      says that in those words rather than issuing a badge.
--
--   3. What a player HAS DONE — lists posted, deals finished, which lists they
--      keep coming back to, how many contacts they kept. Nobody types these.
--      They are counted by triggers off the board itself, which is the only
--      part of a profile that cannot be written by the person it describes.
--
-- The counters are tables rather than queries on purpose. Listings are hard
-- deleted when their window closes, so `count(*) from service_listings` would
-- answer "how many are up right now", quietly re-labelled as a career total. A
-- counter incremented at the moment it happens is the only number here that
-- stays true a week later.
-- ---------------------------------------------------------------------------


-- --- 1. what a player says --------------------------------------------------

alter table public.profiles
  add column if not exists game_tags text[] not null default '{}',
  add column if not exists tags      text[] not null default '{}';

select mintplaza.add_check('public.profiles', 'profiles_game_tags_check',
  'cardinality(game_tags) <= 8');

select mintplaza.add_check('public.profiles', 'profiles_tags_check',
  'cardinality(tags) <= 6');


-- --- 2. what a player shows -------------------------------------------------

create table if not exists public.profile_proofs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  game_slug    text not null references public.games(slug)  on delete cascade,
  -- A path inside the `proofs` bucket, never a URL. Storing a URL would let a
  -- profile point its picture at any host on the internet, which turns every
  -- profile view into a request to a stranger's server — an IP log at best.
  -- The first path segment must be the owner's id, so a row cannot claim a
  -- file uploaded by somebody else.
  storage_path text not null
    check (length(storage_path) <= 300
           and split_part(storage_path, '/', 1) = user_id::text),
  caption      text check (char_length(caption) <= 120),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists profile_proofs_owner_idx
  on public.profile_proofs (user_id, game_slug, sort_order, created_at);

alter table public.profile_proofs enable row level security;

do $$ begin
  create policy "proofs are public" on public.profile_proofs
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own proofs" on public.profile_proofs
    for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Six per game. Three is what the site asks for; the cap exists so a profile
-- cannot become an album, and so one player cannot fill the bucket.
create or replace function public.enforce_proof_cap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.profile_proofs
      where user_id = new.user_id and game_slug = new.game_slug) >= 6 then
    raise exception 'Six pictures is the most for one game. Delete one first.';
  end if;
  return new;
end $$;

drop trigger if exists profile_proofs_cap on public.profile_proofs;
create trigger profile_proofs_cap before insert on public.profile_proofs
for each row execute function public.enforce_proof_cap();


-- --- 3. what a player has done ----------------------------------------------

create table if not exists public.profile_stats (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  lists_posted integer not null default 0,
  deals_done   integer not null default 0,
  updated_at   timestamptz not null default now()
);

alter table public.profile_stats enable row level security;

do $$ begin
  create policy "stats are public" on public.profile_stats
    for select using (true);
exception when duplicate_object then null; end $$;
-- Deliberately no insert/update/delete policy. The triggers below are the only
-- writers, and they are the reason these numbers mean anything.

create table if not exists public.profile_deal_tally (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  game_slug  text not null,
  service_id text not null,
  times      integer not null default 0,
  last_at    timestamptz not null default now(),
  primary key (user_id, game_slug, service_id)
);

alter table public.profile_deal_tally enable row level security;

do $$ begin
  create policy "tally is public" on public.profile_deal_tally
    for select using (true);
exception when duplicate_object then null; end $$;

create or replace function public.bump_lists_posted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile_stats (user_id, lists_posted)
  values (new.author_id, 1)
  on conflict (user_id) do update
    set lists_posted = profile_stats.lists_posted + 1, updated_at = now();
  return new;
end $$;

drop trigger if exists service_listings_count_posts on public.service_listings;
create trigger service_listings_count_posts
after insert on public.service_listings
for each row execute function public.bump_lists_posted();

-- A deal counts when it locks, and it counts for the poster and for everybody
-- who said yes — not for everybody who was asked. Saying yes is the moment two
-- people agreed to do something together, which is the thing being counted.
create or replace function public.credit_locked_deal() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_sid  text;
begin
  if new.stage <> 'locked' or old.stage is not distinct from 'locked' then
    return new;
  end if;

  for v_user in
    select new.author_id
    union
    select p.user_id from public.service_picks p
    where p.listing_id = new.id and p.reply = 'agreed'
  loop
    insert into public.profile_stats (user_id, deals_done)
    values (v_user, 1)
    on conflict (user_id) do update
      set deals_done = profile_stats.deals_done + 1, updated_at = now();

    foreach v_sid in array new.service_ids loop
      insert into public.profile_deal_tally (user_id, game_slug, service_id, times, last_at)
      values (v_user, new.game_slug, v_sid, 1, now())
      on conflict (user_id, game_slug, service_id) do update
        set times = profile_deal_tally.times + 1, last_at = now();
    end loop;
  end loop;

  return new;
end $$;

drop trigger if exists service_listings_credit_deal on public.service_listings;
create trigger service_listings_credit_deal
after update of stage on public.service_listings
for each row execute function public.credit_locked_deal();


-- --- 4. contacts ------------------------------------------------------------
--
-- One row per direction, on purpose. Adding somebody puts them in YOUR list and
-- does nothing to theirs, so a person who declined has declined. A thread only
-- opens where both rows exist, which is the difference between a contact list
-- and a way to message a person who said no.

create table if not exists public.contacts (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  contact_id     uuid not null references public.profiles(id) on delete cascade,
  game_slug      text not null references public.games(slug)  on delete cascade,
  met_service_id text,
  met_at         timestamptz not null default now(),
  primary key (user_id, contact_id),
  check (user_id <> contact_id)
);

create index if not exists contacts_game_idx on public.contacts (user_id, game_slug, met_at desc);

alter table public.contacts enable row level security;

do $$ begin
  create policy "read own contacts" on public.contacts
    for select to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "drop own contacts" on public.contacts
    for delete to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
-- No insert policy: add_contact() below is the only door, because the rule it
-- enforces — you finished a deal together — is the whole feature.

create or replace function public.add_contact(p_other uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me     uuid := auth.uid();
  v_game text;
  v_sid  text;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if p_other = me then raise exception 'That is you.'; end if;
  if not exists (select 1 from public.profiles where id = p_other and status <> 'suspended') then
    raise exception 'That player is not here.';
  end if;

  -- The deal you shared. "Shared" means one of three shapes: they came to your
  -- listing, you came to theirs, or you both said yes to a third person's. Any
  -- of the three means you were in the same room; nothing else does.
  select l.game_slug, l.service_ids[1]
    into v_game, v_sid
  from public.service_listings l
  where l.stage = 'locked'
    and (
         (l.author_id = me
          and exists (select 1 from public.service_picks p
                      where p.listing_id = l.id and p.user_id = p_other and p.reply = 'agreed'))
      or (l.author_id = p_other
          and exists (select 1 from public.service_picks p
                      where p.listing_id = l.id and p.user_id = me and p.reply = 'agreed'))
      or (exists (select 1 from public.service_picks p
                  where p.listing_id = l.id and p.user_id = me and p.reply = 'agreed')
          and exists (select 1 from public.service_picks p
                      where p.listing_id = l.id and p.user_id = p_other and p.reply = 'agreed'))
    )
  order by l.created_at desc
  limit 1;

  -- No deal, no contact. This is the whole safety model of the messaging side
  -- of the site: there is no username search and no invite link, so the only
  -- way to reach a person is to have already been somewhere with them.
  if v_game is null then
    raise exception 'You can only add somebody you just finished a deal with.';
  end if;

  insert into public.contacts (user_id, contact_id, game_slug, met_service_id)
  values (me, p_other, v_game, v_sid)
  on conflict (user_id, contact_id) do nothing;
end $$;

create or replace function public.remove_contact(p_other uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  delete from public.contacts where user_id = auth.uid() and contact_id = p_other;
end $$;


-- --- 5. editing your own profile --------------------------------------------

-- Tags are shown next to a name, so they are the cheapest place on the site to
-- put a lie that looks official. The whitelist is what keeps "MintPlaza staff"
-- typable and "mintplaza.gg/free" not.
create or replace function public.normalize_tag(p text) returns text
language sql immutable set search_path = public as $$
  select nullif(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'), '')
$$;

create or replace function public.save_profile(
  p_bio text, p_games text[], p_tags text[]
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me      uuid := auth.uid();
  v_bio   text;
  v_games text[];
  v_tags  text[];
  t       text;
  n       text;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  -- Description. Control characters out, length capped, and no links: a
  -- description is the one field on a profile that every scam wants to put a
  -- Discord invite in, and there is nothing else a URL is doing here.
  v_bio := nullif(btrim(regexp_replace(coalesce(p_bio, ''), '[\r\n\t]+', ' ', 'g')), '');
  if char_length(coalesce(v_bio, '')) > 240 then
    raise exception 'Keep the description under 240 characters.';
  end if;
  if v_bio ~* '(https?://|www\.|discord\.(gg|com)|t\.me/|\.gg/|\.com/|\.net/)' then
    raise exception 'Links are not allowed in a description. Say it in words instead.';
  end if;

  -- Game tags have to name a real, switched-on game, so a tag can never
  -- advertise something the site does not run.
  select coalesce(array_agg(distinct g.slug), '{}'::text[])
    into v_games
  from public.games g
  where g.slug = any (coalesce(p_games, '{}'::text[])) and g.is_active;

  if cardinality(v_games) > 8 then
    raise exception 'Eight games is the most you can tag.';
  end if;

  v_tags := '{}'::text[];
  foreach t in array coalesce(p_tags, '{}'::text[]) loop
    n := public.normalize_tag(t);
    continue when n is null;
    if char_length(n) < 2 or char_length(n) > 20 then
      raise exception 'Tags are between 2 and 20 characters. "%" is not.', n;
    end if;
    if n !~ '^[A-Za-z0-9][A-Za-z0-9 ''\-+&.!]*$' then
      raise exception 'Tags can only use letters, numbers and spaces. "%" cannot be used.', n;
    end if;
    -- Case-insensitive de-dupe, so "Active Daily" and "active daily" are one tag.
    if not exists (select 1 from unnest(v_tags) x where lower(x) = lower(n)) then
      v_tags := array_append(v_tags, n);
    end if;
  end loop;

  if cardinality(v_tags) > 6 then
    raise exception 'Six tags is the most. Pick the six that say the most.';
  end if;

  update public.profiles
     set bio = v_bio, game_tags = v_games, tags = v_tags, updated_at = now()
   where id = me;

  return jsonb_build_object('bio', v_bio, 'game_tags', v_games, 'tags', v_tags);
end $$;

create or replace function public.add_proof(
  p_game text, p_path text, p_caption text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me  uuid := auth.uid();
  v_id uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not exists (select 1 from public.games where slug = p_game and is_active) then
    raise exception 'That game is not on MintPlaza.';
  end if;
  if split_part(coalesce(p_path, ''), '/', 1) <> me::text then
    raise exception 'That picture does not belong to this account.';
  end if;

  insert into public.profile_proofs (user_id, game_slug, storage_path, caption, sort_order)
  values (
    me, p_game, p_path,
    nullif(btrim(regexp_replace(coalesce(p_caption, ''), '\s+', ' ', 'g')), ''),
    coalesce((select max(sort_order) + 1 from public.profile_proofs
              where user_id = me and game_slug = p_game), 0)
  )
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.delete_proof(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_path text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  delete from public.profile_proofs
   where id = p_id and user_id = auth.uid()
  returning storage_path into v_path;
  return v_path;
end $$;


-- --- 6. reading a profile ---------------------------------------------------
--
-- One round trip, and one definition of what a profile is. Contacts are
-- private rows, so the count has to be taken in here rather than by the caller
-- — which is also why this is the only thing that can honestly report it.

create or replace function public.public_profile(p_username text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me  uuid := auth.uid();
  r   record;
begin
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.status,
         p.joined_at, p.last_seen_at, p.hide_presence, p.game_tags, p.tags
    into r
  from public.profiles p
  where lower(p.username) = lower(btrim(coalesce(p_username, '')))
  limit 1;

  if r.id is null then return null; end if;
  -- A suspended account is not browsable. Returning the shell would tell
  -- anybody who asked exactly who had been actioned.
  if r.status = 'suspended' then return null; end if;

  return jsonb_build_object(
    'id',           r.id,
    'username',     r.username,
    'displayName',  r.display_name,
    'avatarUrl',    r.avatar_url,
    'bio',          r.bio,
    'joinedAt',     r.joined_at,
    -- The green dot obeys "appear offline" here too, or the setting would be a
    -- switch that hides you everywhere except the page about you.
    'lastSeenAt',   case when r.hide_presence then null else r.last_seen_at end,
    'isMe',         (me is not null and me = r.id),
    'gameTags',     to_jsonb(coalesce(r.game_tags, '{}'::text[])),
    'tags',         to_jsonb(coalesce(r.tags, '{}'::text[])),
    'stats', jsonb_build_object(
      'listsPosted', coalesce((select s.lists_posted from public.profile_stats s where s.user_id = r.id), 0),
      'dealsDone',   coalesce((select s.deals_done   from public.profile_stats s where s.user_id = r.id), 0),
      'contacts',    (select count(*) from public.contacts c where c.user_id = r.id),
      'proofs',      (select count(*) from public.profile_proofs f where f.user_id = r.id)
    ),
    'top', coalesce((
      select jsonb_agg(x)
      from (
        select t.game_slug as "gameSlug", t.service_id as "serviceId", t.times
        from public.profile_deal_tally t
        where t.user_id = r.id
        order by t.times desc, t.last_at desc
        limit 5
      ) x
    ), '[]'::jsonb),
    'proofs', coalesce((
      select jsonb_agg(y order by y."gameSlug", y."sortOrder", y."createdAt")
      from (
        select f.id, f.game_slug as "gameSlug", f.storage_path as "storagePath",
               f.caption, f.sort_order as "sortOrder", f.created_at as "createdAt"
        from public.profile_proofs f
        where f.user_id = r.id
      ) y
    ), '[]'::jsonb)
  );
end $$;


-- --- 7. who may call what ---------------------------------------------------
--
-- Supabase grants EXECUTE to anon and authenticated by default on anything in
-- public, so `revoke from public` alone leaves both holding the key. anon is
-- named explicitly for that reason.

revoke all on function public.save_profile(text, text[], text[])  from public, anon;
revoke all on function public.add_proof(text, text, text)         from public, anon;
revoke all on function public.delete_proof(uuid)                  from public, anon;
revoke all on function public.add_contact(uuid)                   from public, anon;
revoke all on function public.remove_contact(uuid)                from public, anon;
revoke all on function public.public_profile(text)                from public, anon;
revoke all on function public.normalize_tag(text)                 from public, anon;
revoke all on function public.enforce_proof_cap()                 from public, anon, authenticated;
revoke all on function public.bump_lists_posted()                 from public, anon, authenticated;
revoke all on function public.credit_locked_deal()                from public, anon, authenticated;

grant execute on function public.save_profile(text, text[], text[]) to authenticated;
grant execute on function public.add_proof(text, text, text)        to authenticated;
grant execute on function public.delete_proof(uuid)                 to authenticated;
grant execute on function public.add_contact(uuid)                  to authenticated;
grant execute on function public.remove_contact(uuid)               to authenticated;
grant execute on function public.public_profile(text)               to authenticated;


-- --- 8. where the pictures live ---------------------------------------------
--
-- The storage schema is not ours. On Supabase it belongs to
-- supabase_storage_admin, and the SQL editor's role is not a member of it, so
-- CREATE POLICY on storage.objects raises 42501 "must be owner of table
-- objects" — which, unguarded, aborts the entire file at this line and leaves
-- everything below it unapplied. Verified against a database set up the way a
-- real project is.
--
-- So each one is attempted and carried past if the project will not allow it,
-- the same way the auth.users trigger near the top of this file is. The
-- fallback is the dashboard: Storage -> Policies, on the `proofs` bucket. The
-- notice says so rather than failing silently, because a bucket with no policy
-- is a feature that quietly does not work.

do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('proofs', 'proofs', true, 3145728,
          array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
  -- No SVG. An SVG is a document that can run script, and this bucket is served
  -- from the same origin as everything else.
exception when insufficient_privilege then
  raise notice 'Could not create the proofs bucket (%). Make it by hand: Storage -> New bucket -> name it "proofs", public, 3 MB, png/jpeg/webp only.', sqlerrm;
end $$;

do $$ begin
  create policy "proof pictures are readable" on storage.objects
    for select using (bucket_id = 'proofs');
exception
  when duplicate_object then null;
  when insufficient_privilege then
    raise notice 'Could not add the storage read policy (%). Add it in Storage -> Policies on the proofs bucket.', sqlerrm;
end $$;

do $$ begin
  create policy "upload into your own proof folder" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'proofs'
                and (storage.foldername(name))[1] = auth.uid()::text);
exception
  when duplicate_object then null;
  when insufficient_privilege then
    raise notice 'Could not add the storage upload policy (%). Add it in Storage -> Policies on the proofs bucket.', sqlerrm;
end $$;

do $$ begin
  create policy "delete your own proof pictures" on storage.objects
    for delete to authenticated
    using (bucket_id = 'proofs'
           and (storage.foldername(name))[1] = auth.uid()::text);
exception
  when duplicate_object then null;
  when insufficient_privilege then
    raise notice 'Could not add the storage delete policy (%). Add it in Storage -> Policies on the proofs bucket.', sqlerrm;
end $$;


-- ---------------------------------------------------------------------------
-- Five-game build-out (September 2026)
-- ---------------------------------------------------------------------------
-- Fisch and Grow a Garden 2 need rows here before anybody can post in them:
-- service_listings.game_slug is a foreign key onto games.slug, so without them
-- every post would fail on a constraint rather than on anything a player did.
-- (The insert itself lives in the migration; re-running it is a no-op.)
--
-- The three template columns below are the important part. `everyone_rewarded`
-- is three-state on purpose: true is checked-and-yes, false is checked-and-no,
-- NULL is nobody-has-looked. NULL behaves exactly like false, because a
-- recruitment template nobody has checked might be gathering strangers to lose
-- a race they cannot win. `is_draft` keeps a real but unconfirmed template in
-- the catalogue and off the board.

alter table public.service_templates
  add column if not exists everyone_rewarded boolean,
  add column if not exists is_draft          boolean not null default false,
  add column if not exists group_label       text;

-- admin_save_template() was replaced to carry all three; see the migration
-- `five_game_build_out` for the full body.


-- ===========================================================================
-- ===========================================================================
-- Item trading (September 2026)
--
-- The tables for this have existed since the first schema and nothing has ever
-- written to them. Two things were in the way, and this section removes both.
--
-- The first was a key mismatch that made inventory impossible to save at all.
-- `item_id` was `uuid references game_items(id)`, but `game_items` is never
-- seeded — the catalogue lives in TypeScript (src/lib/items.ts), where the
-- proof script can check it, and it reaches the browser compiled in. So
-- getCatalog() falls back to that catalogue, whose ids are slugs, and every
-- insert pushed a slug like 'gag2-cosmetic-bookcase' into a uuid column and
-- came back 22P02. Not one inventory row was ever written.
--
-- The fix is to key on the slug, which is what the application has always
-- actually held. Slugs are stable, readable in a query, and survive a
-- catalogue rebuild; uuids would need a seeding job nobody has written and a
-- drift bug for every row it missed. game_items keeps its uuid primary key for
-- the admin Studio to edit — it is an override layer, not the source of truth,
-- and it already records its slug in attributes->>'slug'.
--
-- The second was that matching lived entirely in SQL, where it cannot work.
-- A verdict needs values, values live in values.ts, and duplicating them into
-- Postgres would give the site two sources of truth for the only number
-- players actually argue about. So the split is: SQL narrows (it has the
-- indexes), TypeScript ranks (it has the values). See src/lib/match.ts.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Re-key inventory and listing sides onto catalogue slugs
--
-- Written to be safe on a database that somehow does hold uuid rows: anything
-- already there is translated back through game_items.attributes->>'slug'
-- where a slug is recorded, and dropped where it is not, because a bare uuid
-- means nothing once the column is text and would only ever fail to match.
-- ---------------------------------------------------------------------------

-- Done as add-copy-drop-rename rather than ALTER COLUMN TYPE, because the
-- translation needs a lookup in game_items and a USING expression may not
-- contain a subquery. The check constraint naming item_id is dropped first and
-- restored after, so it never has to survive the column going away.

do $$
begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'inventory_entries'
         and column_name = 'item_id') = 'uuid' then

    alter table public.inventory_entries
      drop constraint if exists inventory_entries_item_id_fkey,
      drop constraint if exists inventory_needs_an_item;

    alter table public.inventory_entries add column if not exists item_slug text;

    update public.inventory_entries e
       set item_slug = gi.attributes->>'slug'
      from public.game_items gi
     where gi.id = e.item_id;

    alter table public.inventory_entries drop column item_id;
    alter table public.inventory_entries rename column item_slug to item_id;

    -- The header above says an untranslatable row is dropped. This is where
    -- that has to actually happen: a uuid no game_items row records a slug for
    -- lands here as NULL, and a row with neither an item_id nor a custom_name
    -- violates the constraint being restored on the very next line — which
    -- aborts the whole migration on any database that has one. An empty
    -- inventory (the usual case, since inventory never saved) deletes nothing.
    delete from public.inventory_entries
     where item_id is null and custom_name is null;

    alter table public.inventory_entries add constraint inventory_needs_an_item
      check (item_id is not null or custom_name is not null);
  end if;
end $$;

do $$
begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'listing_sides'
         and column_name = 'item_id') = 'uuid' then

    alter table public.listing_sides
      drop constraint if exists listing_sides_item_id_fkey,
      drop constraint if exists listing_side_needs_an_item;

    alter table public.listing_sides add column if not exists item_slug text;

    update public.listing_sides s
       set item_slug = gi.attributes->>'slug'
      from public.game_items gi
     where gi.id = s.item_id;

    alter table public.listing_sides drop column item_id;
    alter table public.listing_sides rename column item_slug to item_id;

    -- Same reasoning as inventory_entries above. A side that can name neither
    -- an item nor a custom name is not a side anybody could render, and
    -- leaving it in place would fail the constraint on the next line.
    delete from public.listing_sides
     where item_id is null and custom_name is null;

    alter table public.listing_sides add constraint listing_side_needs_an_item
      check (item_id is not null or custom_name is not null);
  end if;
end $$;

-- A slug is a slug, and specifically is not a uuid.
--
-- The second half is the point. Every catalogue slug is lowercase letters,
-- digits and hyphens — and so is a uuid, so a charset rule alone would accept
-- the exact value this migration exists to stop being written. Anything still
-- sending uuids is code that predates the change, and it should fail loudly on
-- the insert rather than write a row that matches nothing and can never be
-- explained. Requiring a leading letter also rules out the empty string, so the
-- "an item_id or a custom_name" constraint cannot be satisfied by a blank.
--
-- Checked against the real catalogue by the proof script: all 10,323 ids match
-- the first pattern and none matches the second.
create or replace function mintplaza.is_item_slug(p text) returns boolean
language sql immutable as $$
  select p ~ '^[a-z][a-z0-9-]{0,119}$'
     and p !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

select mintplaza.add_check('public.inventory_entries', 'inventory_item_slug_shape',
  'item_id is null or mintplaza.is_item_slug(item_id)');

select mintplaza.add_check('public.listing_sides', 'listing_sides_item_slug_shape',
  'item_id is null or mintplaza.is_item_slug(item_id)');

-- One row per item per variant per list. Without this, tapping Add twice on a
-- flaky connection quietly doubles a holding and every total downstream is
-- wrong. The variant is part of the key because a Midnight rod and a plain one
-- are different holdings, not the same holding counted twice.
--
-- coalesce, not the bare expression. Most rows name no variant, so most rows
-- have NULL there — and NULLs are distinct from each other in a unique index,
-- which would have made this index hold for exactly the variant rows and do
-- nothing at all for the common case. Folding NULL to '' is what makes two
-- plain holdings collide. (NULLS NOT DISTINCT would also do it, and needs
-- Postgres 15; this needs nothing.)
create unique index if not exists inventory_entry_unique_idx
  on public.inventory_entries
     (user_id, game_slug, kind, item_id, (coalesce(attributes->>'variant', '')))
  where item_id is not null;

-- Matching reads "who has this / who wants this" far more often than it reads
-- one person's list, and it always reads it per game.
drop index if exists public.inventory_item_idx;
create index if not exists inventory_match_idx
  on public.inventory_entries (game_slug, kind, item_id) where item_id is not null;

drop index if exists public.listing_sides_match_idx;
create index if not exists listing_sides_match_idx
  on public.listing_sides (item_id, side) where item_id is not null;



-- ---------------------------------------------------------------------------
-- Reading the board
--
-- One row shape for four questions — the whole board, the listings that touch
-- my lists, one person's listings, and my own — so the application has a
-- single mapper and the four surfaces cannot drift apart.
--
-- Every one of them filters on `expires_at > now()` as well as on status.
-- expire_listings() is a scheduled job, and a job that has not run yet, or has
-- been switched off, must not be able to put a stale listing in front of
-- somebody. Status is the intent; the clock is the truth.
-- ---------------------------------------------------------------------------

drop function if exists public.recommended_listings(text, int, timestamptz);

-- The row shape every board read returns.
--
-- "Create it unless it exists" is not enough on a database that has seen an
-- earlier version of this file: a type that exists with DIFFERENT columns is
-- silently kept, and then every function below that returns it either fails to
-- create or returns something the application cannot read. So the existing one
-- is compared against the intended shape and replaced when it does not match.
--
-- CASCADE is safe precisely here: the only things that depend on this type are
-- the six reader functions, and all six are defined further down this same
-- file, so whatever the drop takes is put back before the file ends.
do $$
declare
  want text := 'listing_id uuid, game_slug text, user_id uuid, username text, '
            || 'display_name text, avatar_url text, online boolean, deals integer, '
            || 'note text, created_at timestamp with time zone, '
            || 'bumped_at timestamp with time zone, expires_at timestamp with time zone, '
            || 'bumpable boolean, sides jsonb';
  have text;
begin
  select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod), ', '
                    order by a.attnum)
    into have
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'mintplaza' and c.relname = 'listing_row'
     and a.attnum > 0 and not a.attisdropped;

  if have is null then
    create type mintplaza.listing_row as (
      listing_id uuid, game_slug text,
      user_id uuid, username text, display_name text,
      avatar_url text, online boolean, deals int,
      note text, created_at timestamptz, bumped_at timestamptz,
      expires_at timestamptz, bumpable boolean, sides jsonb
    );
  elsif have <> want then
    raise notice 'mintplaza.listing_row has an old shape; replacing it.';
    drop type mintplaza.listing_row cascade;
    create type mintplaza.listing_row as (
      listing_id uuid, game_slug text,
      user_id uuid, username text, display_name text,
      avatar_url text, online boolean, deals int,
      note text, created_at timestamptz, bumped_at timestamptz,
      expires_at timestamptz, bumpable boolean, sides jsonb
    );
  end if;
end $$;

-- Every read below draws from this one. It is in the mintplaza schema, not
-- public, so PostgREST cannot reach it: it applies no block filter and no
-- ownership filter, and those are the wrappers' job.
create or replace function mintplaza.live_listings(p_game text)
returns setof mintplaza.listing_row
language sql stable set search_path = public, pg_catalog as $$
  select l.id, l.game_slug, l.user_id, p.username, p.display_name, p.avatar_url,
         (p.hide_presence = false
          and p.last_seen_at > now() - interval '120 minutes'),
         coalesce(st.deals_done, 0),
         l.note, l.created_at, l.bumped_at, l.expires_at,
         (l.user_id = auth.uid() and l.bumped_at < now() - interval '24 hours'),
         coalesce(
           (select jsonb_agg(jsonb_build_object(
                     'side', s.side, 'itemId', s.item_id,
                     'customName', s.custom_name, 'quantity', s.quantity,
                     'attributes', s.attributes) order by s.side, s.id)
              from public.listing_sides s where s.listing_id = l.id),
           '[]'::jsonb)
    from public.trade_listings l
    join public.profiles p on p.id = l.user_id
    left join public.profile_stats st on st.user_id = l.user_id
   where l.game_slug = p_game
     and l.status = 'active'
     and l.expires_at > now();
$$;

-- Nobody is hidden from anybody any more.
--
-- This used to answer "have either of these two blocked the other". Blocking
-- is gone (see the note by the dropped table), so it is now a constant false.
-- It is kept rather than deleted because two board functions call it, and a
-- function that returns false costs nothing while removing it would mean
-- editing query bodies that are correct as they stand — and would make adding
-- any future hide-this-person rule a bigger change than it needs to be.
create or replace function mintplaza.hidden(p_other uuid)
returns boolean language sql immutable set search_path = public, pg_catalog as $$
  select false;
$$;

-- The public board. Newest bump first, the one ordering that does not need to
-- know who is asking.
create or replace function public.trade_feed(
  p_game text, p_limit int default 30, p_cursor timestamptz default null
)
returns setof mintplaza.listing_row
language sql stable security definer set search_path = public, pg_catalog as $$
  select r.* from mintplaza.live_listings(p_game) r
   where (p_cursor is null or r.bumped_at < p_cursor)
     and not mintplaza.hidden(r.user_id)
   order by r.bumped_at desc
   limit least(coalesce(p_limit, 30), 100);
$$;

-- Candidates for matching: only listings that touch my lists in one direction
-- or the other. A prefilter and nothing more — it decides what is worth
-- loading, never what is worth showing. The ranking happens in TypeScript,
-- where the values are.
--
-- The limit is deliberately generous, because ranking reorders heavily. Taking
-- twenty by bump time and then sorting them by fit would mostly be sorting
-- noise, and the one reciprocal match posted yesterday would never be inside
-- the window to be found.
create or replace function public.trade_match_candidates(
  p_game text, p_limit int default 200
)
returns setof mintplaza.listing_row
language sql stable security definer set search_path = public, pg_catalog as $$
  with mine as (
    select kind, item_id from public.inventory_entries
     where user_id = auth.uid() and game_slug = p_game and item_id is not null
  )
  select r.* from mintplaza.live_listings(p_game) r
   where r.user_id <> auth.uid()
     and not mintplaza.hidden(r.user_id)
     and exists (
       select 1 from public.listing_sides s
        join mine m on m.item_id = s.item_id
       where s.listing_id = r.listing_id
         -- they offer something I want, or they want something I have
         and ((s.side = 'offer' and m.kind = 'want')
           or (s.side = 'want'  and m.kind = 'have')))
   order by r.bumped_at desc
   limit least(coalesce(p_limit, 200), 400);
$$;

-- One person's listings, for their profile. No block filter: you opened this
-- page on purpose, and a blocked person's profile is not linked to from
-- anywhere the board renders.
create or replace function public.trade_listings_of(p_user uuid, p_game text)
returns setof mintplaza.listing_row
language sql stable security definer set search_path = public, pg_catalog as $$
  select r.* from mintplaza.live_listings(p_game) r
   where r.user_id = p_user
   order by r.bumped_at desc
   limit 50;
$$;

create or replace function public.my_trade_listings(p_game text)
returns setof mintplaza.listing_row
language sql stable security definer set search_path = public, pg_catalog as $$
  select r.* from mintplaza.live_listings(p_game) r
   where r.user_id = auth.uid()
   order by r.bumped_at desc;
$$;

revoke all on function public.trade_feed(text, int, timestamptz) from public, anon;
revoke all on function public.trade_match_candidates(text, int) from public, anon;
revoke all on function public.trade_listings_of(uuid, text) from public, anon;
revoke all on function public.my_trade_listings(text) from public, anon;
grant execute on function public.trade_feed(text, int, timestamptz) to authenticated, anon;
grant execute on function public.trade_match_candidates(text, int) to authenticated;
grant execute on function public.trade_listings_of(uuid, text) to authenticated, anon;
grant execute on function public.my_trade_listings(text) to authenticated;


-- ---------------------------------------------------------------------------
-- Posting
--
-- One call, one transaction. Posting the listing and then its sides as two
-- round trips would leave a listing with no items on the board every time the
-- second one failed, and the board has no way to render that except as an
-- empty card.
-- ---------------------------------------------------------------------------

create or replace function public.post_trade_listing(
  p_game text, p_offer jsonb, p_want jsonb, p_note text default null
)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_listing uuid;
  v_row     jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_offer) <> 'array' or jsonb_array_length(p_offer) = 0 then
    raise exception 'A listing has to offer something.' using errcode = 'P0001';
  end if;
  -- An empty want array is legitimate — it means open to offers. A listing
  -- with nothing on either side is not.
  if jsonb_typeof(p_want) <> 'array' then
    raise exception 'The wanted side must be a list.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_offer) > 12 or jsonb_array_length(p_want) > 12 then
    raise exception 'Twelve items a side is the most a listing can carry.'
      using errcode = 'P0001';
  end if;

  -- The limit trigger on this insert is what enforces the window. It raises
  -- P0001 with the reason, and that message is written to be shown to a player
  -- exactly as it is.
  insert into public.trade_listings (user_id, game_slug, note)
  values (auth.uid(), p_game, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_listing;

  for v_row in select * from jsonb_array_elements(p_offer) loop
    insert into public.listing_sides (listing_id, side, item_id, quantity, attributes)
    values (v_listing, 'offer', v_row->>'itemId',
            greatest(1, least(9999, coalesce((v_row->>'quantity')::int, 1))),
            coalesce(v_row->'attributes', '{}'::jsonb));
  end loop;

  for v_row in select * from jsonb_array_elements(p_want) loop
    insert into public.listing_sides (listing_id, side, item_id, quantity, attributes)
    values (v_listing, 'want', v_row->>'itemId',
            greatest(1, least(9999, coalesce((v_row->>'quantity')::int, 1))),
            coalesce(v_row->'attributes', '{}'::jsonb));
  end loop;

  return v_listing;
end $$;

create or replace function public.cancel_trade_listing(p_listing uuid)
returns void language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  update public.trade_listings
     set status = 'cancelled', updated_at = now()
   where id = p_listing and user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'That listing is not yours to cancel.' using errcode = 'P0001';
  end if;
end $$;

revoke all on function public.post_trade_listing(text, jsonb, jsonb, text) from public, anon;
revoke all on function public.cancel_trade_listing(uuid) from public, anon;
grant execute on function public.post_trade_listing(text, jsonb, jsonb, text) to authenticated;
grant execute on function public.cancel_trade_listing(uuid) to authenticated;


-- ===========================================================================
-- ===========================================================================
-- Completing the file (September 2026)
--
-- Everything below was previously "applied live as a migration" and never
-- written down here, which made this file's own claim to be the whole picture
-- untrue. Applying it to a fresh Supabase project produced a database the
-- application could not run against: seventeen of the twenty-nine functions
-- the app calls by name did not exist, four tables had no row-level security
-- at all, and one missing table broke sign-in for everybody.
--
-- Found by running the file against a real Postgres and then calling what the
-- application actually calls, rather than by reading it. In order of how badly
-- each one bit:
--
--   1. mintplaza.admin_allowlist was referenced by bind_admin_on_first_signin()
--      and created nowhere. PL/pgSQL resolves table names at run time, not at
--      CREATE time, so the file applied clean and then threw 42P01 on the
--      first sign-in — inside ensure_profile(), whose only exception handler
--      catches unique_violation. Every sign-in failed.
--   2. fisch and gag2 had no games row. Both are in the app's registry and its
--      switcher, and inventory_entries.game_slug is a foreign key onto
--      games.slug, so adding any item in either game failed on the constraint.
--   3. service_listings had no ref_id column, which postListing() writes.
--   4. service_listings, _votes, _picks and _comments had RLS left off, so
--      PostgREST exposed all four to any signed-in player: anybody could
--      delete anybody's listing, or vote as somebody else.
--   5. board_listings(), is_admin(), the four console_* and the eleven admin_*
--      functions were all missing.
--
-- The rules encoded here are the ones the file already documented at
-- "Raids & Services: the board" as verified against the live database. They
-- are written out properly this time.
-- ===========================================================================
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- Clearing the way for the definitions below
--
-- CREATE OR REPLACE FUNCTION cannot change a function's return type, and it
-- cannot rename an input parameter. It raises instead:
--
--   ERROR:  cannot change return type of existing function
--   HINT:   Use DROP FUNCTION board_listings(text) first.
--
-- Every function named below either did not exist when this file was written
-- or existed only in a migration applied straight to a live project. A
-- database carrying one of those earlier versions — which is exactly what the
-- project this was built for is carrying — stops dead here rather than being
-- upgraded, and it stops at a statement whose error says nothing about how the
-- database got that way.
--
-- So each name is dropped first, in every overload it may exist in. By name
-- rather than by signature, because the whole problem is not knowing what
-- signature is already there. RESTRICT, not CASCADE: if something genuinely
-- depends on one of these, that is worth a notice rather than a silent
-- demolition, and the CREATE below will then say so plainly.
-- ---------------------------------------------------------------------------
do $$
declare
  names text[] := array[
    'is_admin', 'board_listings',
    'console_unlock', 'console_unlocked', 'console_lock', 'console_phrase_matches',
    'admin_reports', 'admin_resolve_report', 'admin_set_explore_tabs',
    'admin_save_game', 'admin_set_game_active', 'admin_reorder_games',
    'admin_save_template', 'admin_set_template_active',
    'admin_add_media', 'admin_delete_media',
    'enforce_service_listing_limit', 'block_self_vote', 'stamp_pick_reply',
    'cleanup_service_listings',
    'admin_support_messages', 'admin_resolve_support', 'enforce_support_rate',
    'my_level_up', 'admin_grant_level_up', 'admin_revoke_level_up', 'admin_level_ups',
    'start_conversation', 'my_conversations', 'conversation_thread',
    'mark_conversation_read', 'unread_count',
    'enforce_message_rate', 'bump_conversation', 'webhook_grant_level_up'
    -- accept_terms and has_accepted_terms are deliberately NOT in this list.
    -- They are defined much earlier in the file now, because the messages and
    -- listings rules read them, and this block runs AFTER that point — so
    -- naming them here drops the functions the rest of the schema depends on.
  ];
  r record;
  dropped int := 0;
begin
  for r in
    select n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'mintplaza')
       and p.proname = any (names)
  loop
    begin
      execute format('drop function %I.%I(%s)', r.nspname, r.proname, r.args);
      dropped := dropped + 1;
    exception when dependent_objects_still_exist then
      raise notice 'Kept %.%(%) — something depends on it; it will be replaced in place instead.',
        r.nspname, r.proname, r.args;
    end;
  end loop;

  if dropped > 0 then
    raise notice 'Replaced % earlier function definition(s).', dropped;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- The owner's allowlist
--
-- One row per person allowed into the control panel, seeded with a Roblox
-- USERNAME because that is the only thing somebody knows about their own
-- account before they have ever signed in. The username is used exactly once:
-- the first sign-in that matches pins the numeric Roblox id, and every check
-- afterwards is against that id alone, so somebody who later renames
-- themselves to a seeded username matches nothing.
--
-- It ships EMPTY. An empty allowlist means nobody is an admin and /admin stays
-- shut, which is the right way for this to fail. To open it, run this once
-- with your own Roblox username:
--
--   insert into mintplaza.admin_allowlist (roblox_username) values ('YourName')
--   on conflict do nothing;
--
-- then sign in. No password goes in this table and none is needed: the Roblox
-- account is the credential.
-- ---------------------------------------------------------------------------

create table if not exists mintplaza.admin_allowlist (
  roblox_username text primary key,
  -- Null until the first matching sign-in pins it. Once set, it is the key.
  roblox_user_id  text unique,
  bound_at        timestamptz,
  added_at        timestamptz not null default now()
);

alter table mintplaza.admin_allowlist enable row level security;
-- No policy of any kind: the mintplaza schema is not exposed over PostgREST,
-- and the only reader is is_admin(), which is SECURITY DEFINER.

-- Redefined with a guard. The binding is a convenience — it decides who may
-- open a control panel — and it must never be able to fail a sign-in, which is
-- exactly what it did when the table above did not exist.
create or replace function mintplaza.bind_admin_on_first_signin()
returns void language plpgsql security definer
set search_path = mintplaza, public, pg_catalog as $$
begin
  update mintplaza.admin_allowlist a
     set roblox_user_id = p.roblox_user_id,
         bound_at       = now()
    from public.profiles p
   where p.id = auth.uid()
     and a.roblox_user_id is null
     and lower(a.roblox_username) = lower(p.username);
exception
  -- Nobody gets locked out of the site because the panel's allowlist had a
  -- problem. Worst case the owner is not bound yet and opens the panel later.
  when others then
    raise notice 'admin binding skipped: %', sqlerrm;
end $$;

revoke all on function mintplaza.bind_admin_on_first_signin() from public, anon, authenticated;

/**
 * Is the caller the owner?
 *
 * Read by the panel on every action, and the gate inside every admin_ function
 * below. Matches on the pinned Roblox id, never on the username — see above.
 */
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public, mintplaza, pg_catalog as $$
  select exists (
    select 1
      from public.profiles p
      join mintplaza.admin_allowlist a on a.roblox_user_id = p.roblox_user_id
     where p.id = auth.uid()
       and a.roblox_user_id is not null
       and p.status = 'active'
  );
$$;

revoke all on function public.is_admin() from public;
-- anon as well as authenticated, and deliberately. is_admin() is read inside
-- RLS policies, and a policy is evaluated as whoever is querying — so a role
-- without EXECUTE turns a read that should return nothing into "permission
-- denied for function is_admin". It answers from auth.uid(),
-- which is null for a signed-out visitor, so to anon it is a function that
-- returns false and discloses nothing.
grant execute on function public.is_admin() to authenticated, anon;

-- Raised by every admin_ function when the caller is not the owner. "Not found"
-- rather than "forbidden" on purpose: a signed-in stranger poking at the RPC
-- surface learns nothing about whether these functions do anything.
create or replace function mintplaza.require_admin() returns void
language plpgsql stable security definer set search_path = public, pg_catalog as $$
begin
  if not public.is_admin() then
    raise exception 'Not found.' using errcode = 'P0001';
  end if;
end $$;

revoke all on function mintplaza.require_admin() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- The two games the file never seeded
--
-- Both are in src/lib/games.ts and both appear in the game switcher, so the app
-- offers them and then the database refused every write in them. Same upsert
-- shape as the six above, so re-running changes nothing that has been edited
-- since except the presentation fields, which the Studio owns anyway.
-- ---------------------------------------------------------------------------

insert into public.games (slug, name, short_name, blurb, modules, activity_kinds, item_categories, hue, art, sort_order) values
  ('fisch', 'Fisch', 'Fisch',
   'The huge fishing game — catch, mutate and trade over a thousand fish, and find the second pair of hands the Grotto puzzle actually needs.',
   '{trades,inventory,activities,services,help}',
   '{Puzzle,Crew,Hunt,Event,Island,Grind}',
   '{Fish,Rod,Item,"Rod Skin",Bait,Bobber,Totem,Gliders,Boat,Relics}',
   '#127D91', '/games/fisch.jpg', 7),

  ('gag2', 'Grow a Garden 2', 'GAG2',
   'Plant, grow offline, sell for Sheckles and defend against night raids. Items move by one-way Mailbox gift — there is no protected trade window in this game.',
   '{trades,inventory,activities,help}',
   '{Crew}',
   '{Cosmetic,Crop,Gear,Pet,Crate,Seed,Pack,Egg,Chest,"Mutation Item"}',
   '#4CAF50', '', 8)
on conflict (slug) do update set
  name = excluded.name, short_name = excluded.short_name, blurb = excluded.blurb,
  modules = excluded.modules, activity_kinds = excluded.activity_kinds,
  item_categories = excluded.item_categories, hue = excluded.hue,
  art = excluded.art, sort_order = excluded.sort_order;


-- ---------------------------------------------------------------------------
-- The column postListing() writes and the table did not have
--
-- The reference picture a poster picked, where the template offers a choice.
-- Free text rather than a foreign key: the refs live in service_templates.refs
-- as jsonb and in the code catalogue, so there is no table to point at.
-- ---------------------------------------------------------------------------

alter table public.service_listings
  add column if not exists ref_id text;

select mintplaza.add_check('public.service_listings', 'service_listings_ref_id_check',
  'ref_id is null or length(ref_id) <= 80');


-- ---------------------------------------------------------------------------
-- Three live posts per game
--
-- A trigger rather than an application check, because two tabs submitting at
-- the same moment is exactly when an application count is wrong. Counts LIVE
-- posts, not posts created: a services listing is hard-deleted when its window
-- closes, so counting creations would never let the slot back.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_service_listing_limit()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_live int;
begin
  perform 1 from public.profiles where id = new.author_id for update;

  select count(*) into v_live
    from public.service_listings
   where author_id = new.author_id
     and game_slug = new.game_slug
     and expires_at > now();

  if v_live >= 3 then
    raise exception 'You already have three live posts in this game. Take one down first.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists service_listings_limit on public.service_listings;
create trigger service_listings_limit
  before insert on public.service_listings
  for each row execute function public.enforce_service_listing_limit();

revoke all on function public.enforce_service_listing_limit() from public, anon, authenticated;

-- You cannot put your hand up for your own post.
create or replace function public.block_self_vote()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if exists (select 1 from public.service_listings
              where id = new.listing_id and author_id = new.user_id) then
    raise exception 'That is your own post.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists service_votes_no_self on public.service_votes;
create trigger service_votes_no_self
  before insert on public.service_votes
  for each row execute function public.block_self_vote();

revoke all on function public.block_self_vote() from public, anon, authenticated;

-- The clock on an answer belongs to the database, not to the person answering.
create or replace function public.stamp_pick_reply()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if new.reply is distinct from old.reply then
    new.replied_at := now();
  end if;
  return new;
end $$;

drop trigger if exists service_picks_stamp on public.service_picks;
create trigger service_picks_stamp
  before update on public.service_picks
  for each row execute function public.stamp_pick_reply();

revoke all on function public.stamp_pick_reply() from public, anon, authenticated;

/**
 * Sweep the board.
 *
 * Services listings are hard-deleted rather than marked expired: the board is a
 * "who is online right now" surface, and a week of dead posts in the table
 * would be a week of rows every read has to filter. Run it from pg_cron every
 * five minutes, or let the reads below carry it — they all filter on the clock
 * anyway, so a sweep that has not run is invisible rather than wrong.
 */
create or replace function public.cleanup_service_listings()
returns int language sql security definer set search_path = public, pg_catalog as $$
  with gone as (
    delete from public.service_listings where expires_at <= now() returning 1
  )
  select count(*)::int from gone;
$$;

revoke all on function public.cleanup_service_listings() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Row-level security for the board
--
-- These four tables were created with no RLS and no policies, which on Supabase
-- means PostgREST hands them to anybody holding an anon key. Every rule below
-- is one the file already claimed was enforced.
-- ---------------------------------------------------------------------------

alter table public.service_listings enable row level security;
alter table public.service_votes    enable row level security;
alter table public.service_picks    enable row level security;
alter table public.service_comments enable row level security;

-- A live listing is public; an expired one is nobody's business before the
-- sweep gets to it.
drop policy if exists service_listings_read on public.service_listings;
create policy service_listings_read on public.service_listings for select
  using (expires_at > now() or author_id = auth.uid() or public.is_moderator());

drop policy if exists service_listings_insert_own on public.service_listings;
create policy service_listings_insert_own on public.service_listings for insert
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.status = 'active')
  );

-- Restaging (voting -> requested -> locked) is the author's alone.
drop policy if exists service_listings_update_own on public.service_listings;
create policy service_listings_update_own on public.service_listings for update
  using (author_id = auth.uid() or public.is_moderator())
  with check (author_id = auth.uid() or public.is_moderator());

drop policy if exists service_listings_delete_own on public.service_listings;
create policy service_listings_delete_own on public.service_listings for delete
  using (author_id = auth.uid() or public.is_moderator());

-- Votes are public: the card shows who has put their hand up.
drop policy if exists service_votes_read on public.service_votes;
create policy service_votes_read on public.service_votes for select using (true);

drop policy if exists service_votes_insert_own on public.service_votes;
create policy service_votes_insert_own on public.service_votes for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.service_listings l
                 where l.id = listing_id and l.expires_at > now()
                   and l.stage = 'voting')
  );

-- You may take your hand back, but not once you have been picked — the other
-- side has already started counting on you.
--
-- service_votes.listing_id is written out in full, and that is the whole
-- correctness of this policy rather than a style choice. Postgres resolves an
-- unqualified column name to the INNERMOST scope that has one, and
-- service_picks has a listing_id too — so the obvious `p.listing_id =
-- listing_id` silently means `p.listing_id = p.listing_id`, which is true for
-- every row.
--
-- That turned this into "not exists any pick by me anywhere", so the first
-- time a player was picked for anything they lost the ability to withdraw a
-- vote on ANY listing, permanently, with no error and nothing in the logs.
-- The policy read correctly and did something else.
drop policy if exists service_votes_delete_own on public.service_votes;
create policy service_votes_delete_own on public.service_votes for delete
  using (
    user_id = auth.uid()
    and not exists (select 1 from public.service_picks p
                     where p.listing_id = public.service_votes.listing_id
                       and p.user_id = auth.uid())
  );

drop policy if exists service_picks_read on public.service_picks;
create policy service_picks_read on public.service_picks for select using (true);

-- Only the author picks, and the composite foreign key already means they can
-- only pick somebody who voted.
drop policy if exists service_picks_insert_author on public.service_picks;
create policy service_picks_insert_author on public.service_picks for insert
  with check (exists (select 1 from public.service_listings l
                       where l.id = listing_id and l.author_id = auth.uid()));

-- The answer is the picked player's to give. The author cannot answer for them,
-- which is the whole point of the row.
drop policy if exists service_picks_answer_own on public.service_picks;
create policy service_picks_answer_own on public.service_picks for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists service_picks_delete_author on public.service_picks;
create policy service_picks_delete_author on public.service_picks for delete
  using (exists (select 1 from public.service_listings l
                  where l.id = listing_id and l.author_id = auth.uid()));

drop policy if exists service_comments_read on public.service_comments;
create policy service_comments_read on public.service_comments for select using (true);

-- The thread is for people going. Voting is the price of posting in it, and the
-- author is in it by definition.
--
-- service_comments.listing_id in full, for the same reason as
-- service_votes_delete_own above: service_votes also has a listing_id, so an
-- unqualified `listing_id` here binds to the inner table and the test becomes
-- `v.listing_id = v.listing_id` — true for every row.
--
-- The effect was that voting ONCE, on anything, bought the right to post in
-- every thread on the site forever, which is exactly the drive-by commenting
-- this policy exists to prevent.
drop policy if exists service_comments_insert_voter on public.service_comments;
create policy service_comments_insert_voter on public.service_comments for insert
  with check (
    author_id = auth.uid()
    and (
      exists (select 1 from public.service_votes v
               where v.listing_id = public.service_comments.listing_id
                 and v.user_id = auth.uid())
      or exists (select 1 from public.service_listings l
                  where l.id = listing_id and l.author_id = auth.uid())
    )
  );

drop policy if exists service_comments_delete_own on public.service_comments;
create policy service_comments_delete_own on public.service_comments for delete
  using (
    author_id = auth.uid()
    or public.is_moderator()
    or exists (select 1 from public.service_listings l
                where l.id = listing_id and l.author_id = auth.uid())
  );


-- ---------------------------------------------------------------------------
-- The board, in one round trip
--
-- Returns the exact shape src/lib/data/board.ts destructures: snake_case at the
-- top level, camelCase inside voters and comments, because that is what the
-- mapper reads. A rename on either side empties the board rather than erroring,
-- so the two are kept together deliberately.
-- ---------------------------------------------------------------------------

create or replace function public.board_listings(p_game text)
returns jsonb language sql stable security definer
set search_path = public, pg_catalog as $$
  select coalesce(jsonb_agg(row_json order by created_at desc), '[]'::jsonb)
  from (
    select
      l.created_at,
      jsonb_build_object(
        'id',                l.id,
        'game_slug',         l.game_slug,
        'side',              l.side,
        'service_ids',       to_jsonb(l.service_ids),
        'terms_kind',        l.terms_kind,
        'terms_item_id',     l.terms_item_id,
        'detail',            l.detail,
        'ref_id',            l.ref_id,
        'stage',             l.stage,
        'created_at',        l.created_at,
        'expires_at',        l.expires_at,
        'vote_cap',          l.vote_cap,
        'slots',             l.slots,
        -- The card counts in minutes from posting against the window the
        -- poster chose, so the window has to come back as a number.
        'window_minutes',
          greatest(1, round(extract(epoch from (l.expires_at - l.created_at)) / 60))::int,
        'vote_count',        (select count(*) from public.service_votes v
                               where v.listing_id = l.id),
        'voters_online',     (select count(*) from public.service_votes v
                               join public.profiles vp on vp.id = v.user_id
                              where v.listing_id = l.id
                                and vp.hide_presence = false
                                and vp.last_seen_at > now() - interval '120 minutes'),
        'you_voted',         exists (select 1 from public.service_votes v
                                      where v.listing_id = l.id and v.user_id = auth.uid()),
        'yours',             (l.author_id = auth.uid()),
        'author',            ap.username,
        'author_avatar_url', ap.avatar_url,
        'author_online',     (ap.hide_presence = false
                              and ap.last_seen_at > now() - interval '120 minutes'),
        'voters', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'userId',    v.user_id,
                   'username',  vp.username,
                   'avatarUrl', vp.avatar_url,
                   'online',    (vp.hide_presence = false
                                 and vp.last_seen_at > now() - interval '120 minutes'),
                   'votedAt',   v.created_at,
                   -- No pick row means they are still just a volunteer.
                   'reply',     coalesce(pk.reply, 'none')
                 ) order by v.created_at)
            from public.service_votes v
            join public.profiles vp on vp.id = v.user_id
            left join public.service_picks pk
              on pk.listing_id = v.listing_id and pk.user_id = v.user_id
           where v.listing_id = l.id), '[]'::jsonb),
        'comments', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id',        c.id,
                   'author',    cp.username,
                   'avatarUrl', cp.avatar_url,
                   'online',    (cp.hide_presence = false
                                 and cp.last_seen_at > now() - interval '120 minutes'),
                   'body',      c.body,
                   'replyTo',   c.reply_to,
                   'createdAt', c.created_at
                 ) order by c.created_at)
            from public.service_comments c
            join public.profiles cp on cp.id = c.author_id
           where c.listing_id = l.id), '[]'::jsonb)
      ) as row_json
      from public.service_listings l
      join public.profiles ap on ap.id = l.author_id
     where l.game_slug = p_game
       -- The clock, not the sweep. A cleanup job that has not run must never
       -- put a dead post in front of somebody.
       and l.expires_at > now()
     order by l.created_at desc
     limit 100
  ) q;
$$;

revoke all on function public.board_listings(text) from public, anon;
grant execute on function public.board_listings(text) to authenticated, anon;


-- ---------------------------------------------------------------------------
-- Value history: removed
--
-- MintPlaza used to keep its own value table and its own W/F/L calculator, and
-- this is what let an admin undo a mistyped value. Both are gone — the
-- reasoning is in src/lib/referrals.ts, and the short version is that a value
-- list is a full-time job in six games at once and a stale number loses a
-- player a trade. Every value question now goes to the site that community
-- already quotes.
--
-- So there is nothing left to record a history OF. Three things happen here,
-- in this order, and all three are safe to run on a database that never had
-- any of it:
--
--   1. The trigger goes first. While it exists, step 3 would fire it on every
--      single row and write a history entry for a value being cleared, which
--      is both pointless and slow on a large catalogue.
--   2. The table goes, after saying how many versions it is taking with it.
--      Nothing reads it — the one function that did, revertValue(), was
--      removed with the calculator.
--   3. The stale keys come out of every item. This is the part that matters:
--      the app stopped READING valuePhysical, valuePermanent and demand, but a
--      database that has been live still has them sitting in attributes, and
--      leaving them there means a future reader could resurrect months-old
--      numbers by accident. Clearing them makes that impossible rather than
--      merely unlikely.
--
-- beli and robux are deliberately left alone. They are the game's own shop
-- prices, published by the developer, and they do not move.
-- ---------------------------------------------------------------------------

drop trigger if exists game_items_value_history on public.game_items;
drop function if exists public.record_item_value() cascade;

do $$
declare v_rows bigint;
begin
  if to_regclass('public.item_value_history') is not null then
    execute 'select count(*) from public.item_value_history' into v_rows;
    raise notice 'Dropping item_value_history and its % recorded version(s). MintPlaza no longer keeps values.', v_rows;
    drop table public.item_value_history;
  end if;
end $$;

do $$
declare v_touched bigint;
begin
  with cleared as (
    update public.game_items
       set attributes = attributes - 'valuePhysical' - 'valuePermanent' - 'demand'
     where attributes ?| array['valuePhysical', 'valuePermanent', 'demand']
    returning 1
  )
  select count(*) into v_touched from cleared;

  if v_touched > 0 then
    raise notice 'Cleared stale value/demand fields from % catalogue row(s).', v_touched;
  end if;
exception
  -- Clearing old numbers is housekeeping, not a precondition. If this cannot
  -- run the app is still correct, because nothing reads those keys any more.
  when others then
    raise notice 'Could not clear stale value fields: %', sqlerrm;
end $$;


-- ---------------------------------------------------------------------------
-- The latch on the panel door
--
-- The account is the lock; this is the latch. It exists for the case where the
-- owner's tablet is left unlocked and signed in — whoever picks it up still
-- cannot open the panel without the code. It is emphatically not what keeps an
-- attacker out; being the one allowlisted Roblox account is, and is_admin()
-- enforces that on every write regardless of this.
--
-- The code is never in the codebase. It lives here as a bcrypt hash, is
-- compared here, and five wrong answers in fifteen minutes stops it answering.
-- A success returns a random token stored only as a sha256 hash, good for eight
-- hours.
--
-- It ships with NO passcode set, and with no passcode set it refuses everybody,
-- which is the right way round. Set one with:
--
--   select mintplaza.set_console_passcode('whatever you will remember');
--
-- Run that as the owner in the SQL editor. Changing it later is the same call.
--
-- ---------------------------------------------------------------------------
-- Why these four functions put `extensions` in their search_path
--
-- They are the only ones here that call pgcrypto — crypt, gen_salt,
-- gen_random_bytes and digest. On Supabase pgcrypto is installed into the
-- `extensions` schema, not public, and Supabase puts `extensions` in the
-- session search_path, which is why the CREATE INDEX statements using
-- gin_trgm_ops near the top of this file resolve without help.
--
-- A function that sets its own search_path does not get that session default.
-- Leaving `extensions` out here therefore created a fault that no amount of
-- applying the file could reveal: every one of these was CREATED without
-- complaint and then raised 42883 "function digest(text, unknown) does not
-- exist" the first time it was actually called. It is listed last in the path
-- so a local pgcrypto in public still wins, which keeps a self-hosted database
-- and a Supabase one on the same code.
-- ---------------------------------------------------------------------------

create table if not exists mintplaza.console_secret (
  id          boolean primary key default true check (id),
  passcode    text not null,
  updated_at  timestamptz not null default now()
);

create table if not exists mintplaza.console_attempt (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  succeeded  boolean not null
);

create index if not exists console_attempt_recent_idx on mintplaza.console_attempt (at desc);

create table if not exists mintplaza.console_session (
  token_hash text primary key,
  opened_at  timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table mintplaza.console_secret  enable row level security;
alter table mintplaza.console_attempt enable row level security;
alter table mintplaza.console_session enable row level security;
-- No policies anywhere. Nothing reads these but the SECURITY DEFINER functions
-- below, and the mintplaza schema is not exposed over PostgREST.

create or replace function mintplaza.set_console_passcode(p_new text)
returns void language plpgsql security definer
set search_path = mintplaza, public, extensions, pg_catalog as $$
begin
  if p_new is null or length(btrim(p_new)) < 4 then
    raise exception 'Pick a code of at least four characters.';
  end if;
  insert into mintplaza.console_secret (id, passcode, updated_at)
  values (true, crypt(btrim(p_new), gen_salt('bf', 10)), now())
  on conflict (id) do update
    set passcode = excluded.passcode, updated_at = now();
  -- A new code retires every open session, or an old tab keeps the door open
  -- after the code was changed precisely because somebody else knew it.
  delete from mintplaza.console_session;
end $$;

revoke all on function mintplaza.set_console_passcode(text) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- The passcode, seeded.
--
-- Set to 1927 on a database that does not have one yet, so the panel is
-- reachable the first time the owner signs in rather than needing a second SQL
-- trip before anything can be administered.
--
-- `where not exists` is doing the important work: this runs on EVERY apply,
-- and without it every re-run would silently reset the code back to 1927 —
-- undoing a change the owner made deliberately, and doing it quietly, which is
-- the worst way for a security control to move.
--
-- It is stored bcrypt-hashed like any other, so it cannot be read back out of
-- the database by anybody, including whoever ran this. Change it any time with:
--     select mintplaza.set_console_passcode('something-else');
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from mintplaza.console_secret) then
    perform mintplaza.set_console_passcode('1927');
    raise notice 'Console passcode seeded as 1927. Change it with mintplaza.set_console_passcode(...).';
  end if;
end $$;

create or replace function public.console_unlock(p_passcode text)
returns text language plpgsql security definer
set search_path = mintplaza, public, extensions, pg_catalog as $$
declare
  v_hash  text;
  v_fails int;
  v_token text;
begin
  -- The latch is behind the lock: only the owner can even try a code.
  if not public.is_admin() then return null; end if;

  select count(*) into v_fails from mintplaza.console_attempt
   where succeeded = false and at > now() - interval '15 minutes';
  if v_fails >= 5 then return null; end if;

  select passcode into v_hash from mintplaza.console_secret where id;
  -- No passcode set means the latch answers nobody. Fails shut.
  if v_hash is null then return null; end if;

  if crypt(coalesce(p_passcode, ''), v_hash) <> v_hash then
    insert into mintplaza.console_attempt (succeeded) values (false);
    return null;
  end if;

  insert into mintplaza.console_attempt (succeeded) values (true);
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into mintplaza.console_session (token_hash, expires_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), now() + interval '8 hours');

  -- Housekeeping on the way past, so neither table grows forever.
  delete from mintplaza.console_session where expires_at <= now();
  delete from mintplaza.console_attempt where at < now() - interval '1 day';

  return v_token;
end $$;

create or replace function public.console_unlocked(p_token text)
returns boolean language sql stable security definer
set search_path = mintplaza, public, extensions, pg_catalog as $$
  select public.is_admin() and exists (
    select 1 from mintplaza.console_session
     where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
       and expires_at > now()
  );
$$;

create or replace function public.console_lock(p_token text)
returns void language sql security definer
set search_path = mintplaza, public, extensions, pg_catalog as $$
  delete from mintplaza.console_session
   where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

/**
 * Does this search phrase open the panel?
 *
 * The panel has no link anywhere in the interface. Typing the phrase into any
 * search box is how the owner reaches it, and for everybody else the phrase
 * matches nothing, so the panel does not exist as far as search is concerned.
 *
 * ---------------------------------------------------------------------------
 * One phrase, matched whole
 * ---------------------------------------------------------------------------
 *
 * This used to accept any of four words: 'control panel', 'console', 'studio'
 * and 'admin'. Every one of them is a word a player might type into a search
 * box by accident, and three of them are words that appear in this site's own
 * help text. The gate held — is_admin() is the real lock and it is checked
 * first — but a hidden door that opens on the word "admin" is not hidden.
 *
 * Now there is exactly one phrase and it is matched whole. A missing letter,
 * an extra letter, a word on its own: all of them are simply not a match, and
 * the search returns the same empty list any unmatched word returns.
 *
 * The leading slash is doing real work. It is a character nobody types while
 * looking for an item, so the phrase can never be reached by accident, and it
 * reads as a command rather than a search, which is what it is.
 *
 * Case is folded and surrounding spaces are trimmed, and neither weakens it:
 * a phone keyboard capitalises and a paste carries a trailing space, and
 * punishing either would mean the owner cannot open their own panel on their
 * own phone. What is NOT forgiven is a wrong character anywhere inside.
 */
create or replace function public.console_phrase_matches(p_phrase text)
returns boolean language sql stable security definer
set search_path = public, pg_catalog as $$
  select public.is_admin()
     and lower(btrim(coalesce(p_phrase, ''))) = '/openadminpanel';
$$;

revoke all on function public.console_unlock(text)          from public, anon;
revoke all on function public.console_unlocked(text)         from public, anon;
revoke all on function public.console_lock(text)             from public, anon;
revoke all on function public.console_phrase_matches(text)   from public, anon;
grant execute on function public.console_unlock(text)        to authenticated;
grant execute on function public.console_unlocked(text)      to authenticated;
grant execute on function public.console_lock(text)          to authenticated;
grant execute on function public.console_phrase_matches(text) to authenticated;


-- ---------------------------------------------------------------------------
-- The Studio
--
-- Every one of these opens with require_admin(). Supabase cannot gate an RPC
-- beyond `authenticated`, so the gate lives inside the function: a signed-in
-- stranger reaches it and is told "Not found." The tables these write have no
-- write policy at all, so these functions are not defence in depth on top of a
-- policy — they are the only door.
-- ---------------------------------------------------------------------------

create or replace function public.admin_reports(p_status text default 'open')
returns jsonb language plpgsql stable security definer
set search_path = public, pg_catalog as $$
declare v jsonb;
begin
  perform mintplaza.require_admin();
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'id', r.id, 'created_at', r.created_at, 'status', r.status,
      'subject_type', r.subject_type, 'subject_id', r.subject_id,
      'subject_label', r.subject_label, 'reason', r.reason, 'detail', r.detail,
      'evidence_url', r.evidence_url,
      'reporter_username',  rp.username,
      'reporter_roblox_id', rp.roblox_user_id,
      'admin_note', r.admin_note
    ) x
    from public.reports r
    left join public.profiles rp on rp.id = r.reporter_id
    where p_status = 'all' or r.status = p_status
    limit 500
  ) q;
  return v;
end $$;

create or replace function public.admin_resolve_report(
  p_id uuid, p_status text, p_note text default null
)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $$
begin
  perform mintplaza.require_admin();
  if p_status not in ('open', 'reviewing', 'actioned', 'dismissed') then
    raise exception 'Unknown status.' using errcode = 'P0001';
  end if;
  update public.reports
     set status      = p_status,
         admin_note  = coalesce(left(p_note, 500), admin_note),
         reviewed_by = auth.uid(),
         resolved_at = case when p_status in ('actioned','dismissed') then now() else null end
   where id = p_id;
end $$;

create or replace function public.admin_set_explore_tabs(p_slug text, p_tabs jsonb)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $$
begin
  perform mintplaza.require_admin();
  -- Checked here for a readable message; the CHECK on the column is what makes
  -- it true for every other write path.
  if not public.valid_explore_tabs(p_tabs) then
    raise exception 'Every tab needs an id, a name under 40 characters, and one of the three kinds.'
      using errcode = 'P0001';
  end if;
  update public.games set explore_tabs = p_tabs where slug = p_slug;
end $$;

create or replace function public.admin_save_game(p jsonb)
returns text language plpgsql security definer
set search_path = public, pg_catalog as $$
declare v_slug text := btrim(coalesce(p->>'slug',''));
begin
  perform mintplaza.require_admin();
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,40}$' then
    raise exception 'The web address part must be lowercase letters, numbers and dashes.'
      using errcode = 'P0001';
  end if;
  if coalesce(btrim(p->>'name'),'') = '' then
    raise exception 'The game needs a name.' using errcode = 'P0001';
  end if;
  if not public.valid_explore_tabs(coalesce(p->'explore_tabs','[]'::jsonb)) then
    raise exception 'One of those tabs is not valid.' using errcode = 'P0001';
  end if;

  insert into public.games
    (slug, name, short_name, blurb, hue, art, modules, item_categories,
     explore_tabs, is_active)
  values (
    v_slug,
    btrim(p->>'name'),
    coalesce(nullif(btrim(p->>'short_name'),''), btrim(p->>'name')),
    nullif(btrim(coalesce(p->>'blurb','')),''),
    nullif(btrim(coalesce(p->>'hue','')),''),
    nullif(btrim(coalesce(p->>'art','')),''),
    coalesce((select array_agg(value::text) from jsonb_array_elements_text(coalesce(p->'modules','[]'::jsonb)) value), '{}'),
    coalesce((select array_agg(value::text) from jsonb_array_elements_text(coalesce(p->'item_categories','[]'::jsonb)) value), '{}'),
    coalesce(p->'explore_tabs','[]'::jsonb),
    coalesce((p->>'is_active')::boolean, true)
  )
  on conflict (slug) do update set
    name = excluded.name, short_name = excluded.short_name, blurb = excluded.blurb,
    hue = excluded.hue, art = excluded.art, modules = excluded.modules,
    item_categories = excluded.item_categories, explore_tabs = excluded.explore_tabs,
    is_active = excluded.is_active;

  return v_slug;
end $$;

create or replace function public.admin_set_game_active(p_slug text, p_active boolean)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $$
begin
  perform mintplaza.require_admin();
  update public.games set is_active = p_active where slug = p_slug;
end $$;

create or replace function public.admin_reorder_games(p_slugs text[])
returns void language plpgsql security definer
set search_path = public, pg_catalog as $$
declare i int;
begin
  perform mintplaza.require_admin();
  for i in 1 .. coalesce(array_length(p_slugs, 1), 0) loop
    update public.games set sort_order = i where slug = p_slugs[i];
  end loop;
end $$;

create or replace function public.admin_save_template(p jsonb)
returns text language plpgsql security definer
set search_path = public, pg_catalog as $$
declare
  v_id      text := lower(btrim(coalesce(p->>'id','')));
  v_section text := coalesce(nullif(btrim(p->>'section'),''), 'services');
  v_players int  := nullif(btrim(coalesce(p->>'players','')), '')::int;
begin
  perform mintplaza.require_admin();
  if v_id !~ '^[a-z0-9][a-z0-9-]{2,60}$' then
    raise exception 'The id must be lowercase letters, numbers and dashes.'
      using errcode = 'P0001';
  end if;
  -- The one rule that keeps the two boards from becoming one board, checked
  -- here for a readable message and by the table constraint for everything else.
  if v_players is not null and v_section = 'services' and v_players > 3 then
    raise exception 'Raids & Services is for one or two helpers. Anything needing more belongs in Help & Recruitment.'
      using errcode = 'P0001';
  end if;
  if v_players is not null and v_section = 'recruit' and v_players < 3 then
    raise exception 'Help & Recruitment is for three or more. Anything smaller belongs in Raids & Services.'
      using errcode = 'P0001';
  end if;

  insert into public.service_templates
    (id, game_slug, name, kind, section, art, needs, players, gives, open_ended,
     aliases, refs, verified, is_active, sort_order, everyone_rewarded, is_draft,
     group_label, updated_at, updated_by)
  values (
    v_id,
    p->>'game_slug',
    left(btrim(p->>'name'), 80),
    p->>'kind',
    v_section,
    nullif(btrim(coalesce(p->>'art','')),''),
    nullif(btrim(coalesce(p->>'needs','')),''),
    v_players,
    nullif(btrim(coalesce(p->>'gives','')),''),
    coalesce((p->>'open_ended')::boolean, false),
    coalesce((select array_agg(value::text) from jsonb_array_elements_text(coalesce(p->'aliases','[]'::jsonb)) value), '{}'),
    coalesce(p->'refs','[]'::jsonb),
    coalesce((p->>'verified')::boolean, true),
    coalesce((p->>'is_active')::boolean, true),
    coalesce((p->>'sort_order')::int, 0),
    -- Three-state: null is "nobody has looked", which is not the same as no.
    case when p->>'everyone_rewarded' is null then null
         else (p->>'everyone_rewarded')::boolean end,
    coalesce((p->>'is_draft')::boolean, false),
    nullif(btrim(coalesce(p->>'group_label','')),''),
    now(), auth.uid()
  )
  on conflict (id) do update set
    game_slug = excluded.game_slug, name = excluded.name, kind = excluded.kind,
    section = excluded.section, art = excluded.art, needs = excluded.needs,
    players = excluded.players, gives = excluded.gives,
    open_ended = excluded.open_ended, aliases = excluded.aliases,
    refs = excluded.refs, verified = excluded.verified,
    is_active = excluded.is_active, sort_order = excluded.sort_order,
    everyone_rewarded = excluded.everyone_rewarded, is_draft = excluded.is_draft,
    group_label = excluded.group_label, updated_at = now(), updated_by = auth.uid();

  return v_id;
end $$;

create or replace function public.admin_set_template_active(p_id text, p_active boolean)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $$
begin
  perform mintplaza.require_admin();
  update public.service_templates
     set is_active = p_active, updated_at = now(), updated_by = auth.uid()
   where id = p_id;
end $$;

create or replace function public.admin_add_media(
  p_url text, p_label text, p_kind text, p_game text default ''
)
returns uuid language plpgsql security definer
set search_path = public, pg_catalog as $$
declare v_id uuid;
begin
  perform mintplaza.require_admin();
  if coalesce(p_url,'') !~* '^(/|https?://)' then
    raise exception 'That does not look like a picture address.' using errcode = 'P0001';
  end if;

  insert into public.media (url, label, kind, game_slug, created_by)
  values (
    btrim(p_url),
    coalesce(nullif(left(btrim(p_label), 80), ''), 'Untitled'),
    case when p_kind in ('item','service','ref','game','other') then p_kind else 'other' end,
    nullif(btrim(coalesce(p_game,'')), ''),
    auth.uid()
  )
  on conflict (url) do update set label = excluded.label, kind = excluded.kind
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.admin_delete_media(p_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $$
begin
  perform mintplaza.require_admin();
  delete from public.media where id = p_id;
end $$;

-- The panel is reachable only by the owner, but the RPC surface is reachable by
-- anybody holding an anon key, so anon is named explicitly on every one.
revoke all on function public.admin_reports(text)                       from public, anon;
revoke all on function public.admin_resolve_report(uuid, text, text)    from public, anon;
revoke all on function public.admin_set_explore_tabs(text, jsonb)       from public, anon;
revoke all on function public.admin_save_game(jsonb)                    from public, anon;
revoke all on function public.admin_set_game_active(text, boolean)      from public, anon;
revoke all on function public.admin_reorder_games(text[])               from public, anon;
revoke all on function public.admin_save_template(jsonb)                from public, anon;
revoke all on function public.admin_set_template_active(text, boolean)  from public, anon;
revoke all on function public.admin_add_media(text, text, text, text)   from public, anon;
revoke all on function public.admin_delete_media(uuid)                  from public, anon;

grant execute on function public.admin_reports(text)                      to authenticated;
grant execute on function public.admin_resolve_report(uuid, text, text)   to authenticated;
grant execute on function public.admin_set_explore_tabs(text, jsonb)      to authenticated;
grant execute on function public.admin_save_game(jsonb)                   to authenticated;
grant execute on function public.admin_set_game_active(text, boolean)     to authenticated;
grant execute on function public.admin_reorder_games(text[])              to authenticated;
grant execute on function public.admin_save_template(jsonb)               to authenticated;
grant execute on function public.admin_set_template_active(text, boolean) to authenticated;
grant execute on function public.admin_add_media(text, text, text, text)  to authenticated;
grant execute on function public.admin_delete_media(uuid)                 to authenticated;


-- ===========================================================================
-- Actually scheduling the two sweeps
--
-- Both cleanup functions were defined here and left for somebody to schedule
-- by hand, which is the same mistake as documenting a rule and not enforcing
-- it: the file said "run from a scheduled job" and then no job existed.
--
--   expire_listings()          marks trade listings expired after seven days
--   cleanup_service_listings() deletes board posts once their window closes
--
-- Neither is load-bearing for correctness. Every read in this file filters on
-- the clock as well as on status, precisely so a sweep that has not run is
-- invisible rather than wrong. What they do is stop the tables growing without
-- bound, which matters over months rather than minutes — so every five minutes
-- is generous and the exact timing does not need to be defended.
--
-- pg_cron may not be available: it is an extension the project has to enable,
-- and on some plans it is not offered at all. That must not fail this file, so
-- the whole thing is guarded and says what to do instead. Enable it under
-- Database -> Extensions -> pg_cron, then re-run this file and the jobs
-- appear.
-- ===========================================================================

do $$
begin
  execute 'create extension if not exists pg_cron';
exception when others then
  raise notice 'pg_cron is not available here (%). The sweeps are defined but will not run on their own; every read filters on the clock regardless, so nothing breaks. Enable it under Database -> Extensions and re-run this file.', sqlerrm;
end $$;

do $$
declare
  jobs text[][] := array[
    ['mintplaza-expire-trade-listings',  '*/5 * * * *', 'select public.expire_listings()'],
    ['mintplaza-cleanup-board-listings', '*/5 * * * *', 'select public.cleanup_service_listings()']
  ];
  i int;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'Skipping the scheduled sweeps: pg_cron is not installed.';
    return;
  end if;

  for i in 1 .. array_length(jobs, 1) loop
    -- Unschedule first so re-running this file replaces the job rather than
    -- stacking a second copy of it beside the first.
    begin
      execute format('select cron.unschedule(%L)', jobs[i][1]);
    exception when others then
      null;  -- no job by that name yet, which is the normal first run
    end;

    execute format('select cron.schedule(%L, %L, %L)',
                   jobs[i][1], jobs[i][2], jobs[i][3]);
    raise notice 'Scheduled % (%).', jobs[i][1], jobs[i][2];
  end loop;
end $$;


-- ===========================================================================
-- ===========================================================================
-- Tell us your problem
--
-- The report button is for a person: somebody scammed me, this comment is
-- abuse. This is the other half — the site itself is broken, or I cannot work
-- out how to do something, and there is nowhere to say so. Without it the only
-- route is the email address in the corner, which most players will not use
-- and which arrives with no idea who sent it or whether they were even signed
-- in.
--
-- Signed-in only, deliberately. An open box is a spam queue, and the person
-- who genuinely cannot sign in is exactly who the email address in the corner
-- is for — it is the fallback, not decoration.
-- ===========================================================================
-- ===========================================================================

create table if not exists public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  -- What the player was looking at. Filled in by the page, not typed: "the
  -- trades screen in PS99" is worth more than a paragraph describing it.
  context     text check (context is null or char_length(context) <= 200),
  status      text not null default 'open'
              check (status in ('open', 'answered', 'closed')),
  admin_note  text check (admin_note is null or char_length(admin_note) <= 2000),
  handled_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_messages_queue_idx
  on public.support_messages (status, created_at desc);
create index if not exists support_messages_sender_idx
  on public.support_messages (user_id, created_at desc);

alter table public.support_messages enable row level security;

-- You may send one, and you may read your own back so the page can show that
-- it arrived. You may never read anybody else's, and you may never change the
-- status — that is the owner's word on it, not yours.
drop policy if exists support_send on public.support_messages;
create policy support_send on public.support_messages for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.status = 'active')
  );

drop policy if exists support_read_own on public.support_messages;
create policy support_read_own on public.support_messages for select
  using (user_id = auth.uid() or public.is_moderator());

-- No update or delete policy at all. A sent message is a record; the owner
-- resolves it through the admin function below.

-- Five a day. Enough for a person having a bad time with the site, few enough
-- that the queue cannot be flooded from one account. In a trigger because an
-- application-side count is wrong exactly when two submits race.
create or replace function public.enforce_support_rate()
returns trigger language plpgsql security definer
set search_path = public, pg_catalog as $$
declare v_today int;
begin
  perform 1 from public.profiles where id = new.user_id for update;

  select count(*) into v_today
    from public.support_messages
   where user_id = new.user_id
     and created_at > now() - interval '24 hours';

  if v_today >= 5 then
    raise exception 'You have sent five messages today. If it is urgent, email us instead.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists support_messages_rate on public.support_messages;
create trigger support_messages_rate
  before insert on public.support_messages
  for each row execute function public.enforce_support_rate();

revoke all on function public.enforce_support_rate() from public, anon, authenticated;

/**
 * The support queue, for the owner.
 *
 * Same shape as admin_reports(): gated inside the function, because Supabase
 * cannot gate an RPC beyond `authenticated`. Carries the sender's username so
 * the panel can say who wrote it without a second round trip.
 */
create or replace function public.admin_support_messages(p_status text default 'open')
returns jsonb language plpgsql stable security definer
set search_path = public, pg_catalog as $$
declare v jsonb;
begin
  perform mintplaza.require_admin();
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'id', m.id, 'created_at', m.created_at, 'status', m.status,
      'body', m.body, 'context', m.context,
      'admin_note', m.admin_note, 'resolved_at', m.resolved_at,
      'sender_username',  p.username,
      'sender_roblox_id', p.roblox_user_id
    ) x
    from public.support_messages m
    left join public.profiles p on p.id = m.user_id
    where p_status = 'all' or m.status = p_status
    limit 500
  ) q;
  return v;
end $$;

create or replace function public.admin_resolve_support(
  p_id uuid, p_status text, p_note text default null
)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $$
begin
  perform mintplaza.require_admin();
  if p_status not in ('open', 'answered', 'closed') then
    raise exception 'Unknown status.' using errcode = 'P0001';
  end if;
  update public.support_messages
     set status      = p_status,
         admin_note  = coalesce(left(p_note, 2000), admin_note),
         handled_by  = auth.uid(),
         resolved_at = case when p_status in ('answered','closed') then now() else null end
   where id = p_id;
end $$;

revoke all on function public.admin_support_messages(text)             from public, anon;
revoke all on function public.admin_resolve_support(uuid, text, text)  from public, anon;
grant execute on function public.admin_support_messages(text)            to authenticated;
grant execute on function public.admin_resolve_support(uuid, text, text) to authenticated;


-- ===========================================================================
-- Level Up: reading it, and granting it
--
-- Split from the entitlement table itself because that block has to exist
-- before the listing limits that read it, and these do not — they only need to
-- exist before the app calls them. Keeping them here means require_admin() and
-- is_admin() are already defined above, rather than being forward-referenced
-- from four hundred lines earlier.
-- ===========================================================================

-- What the signed-in player has. Answers for the caller and nobody else, which
-- is why it takes no argument: a function that accepted a user id would let any
-- signed-in account check whether any other account pays, and a list of paying
-- accounts is a list of accounts worth targeting.
create or replace function public.my_level_up()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_catalog as $$
declare v_row public.entitlements%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('active', false, 'expires_at', null, 'days_left', null);
  end if;

  select * into v_row from public.entitlements
   where user_id = auth.uid() and kind = 'level_up';

  if v_row.user_id is null or v_row.source = 'refunded' or v_row.expires_at <= now() then
    -- An expired subscription still reports its end date. "It ran out on the
    -- 3rd" is a different message from "you have never had this", and the
    -- player deserves the first one rather than being quietly demoted.
    return jsonb_build_object(
      'active', false,
      'expires_at', v_row.expires_at,
      'days_left', null,
      'lapsed', v_row.user_id is not null and v_row.source <> 'refunded'
    );
  end if;

  return jsonb_build_object(
    'active', true,
    'expires_at', v_row.expires_at,
    -- Rounded UP, so the last day of a subscription reads "1 day left" rather
    -- than "0 days left" while it is still working.
    'days_left', ceil(extract(epoch from (v_row.expires_at - now())) / 86400)::int,
    'lapsed', false
  );
end $$;

revoke all on function public.my_level_up() from public, anon;
grant execute on function public.my_level_up() to authenticated;


-- The only way a row is ever written. Admin-only today; this is also the exact
-- shape a payment processor's webhook will call once one exists, which is why
-- it takes a payment reference and why that reference is unique.
--
-- Extending rather than replacing: greatest(now(), expires_at) means renewing
-- early adds to what is left instead of throwing it away, and coming back
-- after a lapse starts from today instead of from a date in the past.
create or replace function public.admin_grant_level_up(
  p_roblox_username text,
  p_days            int  default 60,
  p_country         text default null,
  p_source          text default 'purchase',
  p_payment_ref     text default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_catalog as $$
declare v_user uuid; v_until timestamptz;
begin
  perform mintplaza.require_admin();

  if p_days is null or p_days < 1 or p_days > 3650 then
    raise exception 'Days must be between 1 and 3650.' using errcode = 'P0001';
  end if;
  if p_source not in ('purchase', 'gift', 'comp', 'refunded') then
    raise exception 'Unknown source.' using errcode = 'P0001';
  end if;

  select id into v_user from public.profiles
   where lower(username) = lower(btrim(p_roblox_username));
  if v_user is null then
    raise exception 'No player called % has signed in yet.', p_roblox_username
      using errcode = 'P0001',
            hint = 'They have to sign in once before anything can be granted to them.';
  end if;

  insert into public.entitlements as e
    (user_id, kind, expires_at, source, country, payment_ref, granted_by)
  values
    (v_user, 'level_up', now() + make_interval(days => p_days), p_source,
     nullif(upper(btrim(coalesce(p_country, ''))), ''), nullif(btrim(coalesce(p_payment_ref,'')), ''), auth.uid())
  on conflict (user_id) do update
     set expires_at  = greatest(now(), e.expires_at) + make_interval(days => p_days),
         source      = excluded.source,
         country     = coalesce(excluded.country, e.country),
         payment_ref = coalesce(excluded.payment_ref, e.payment_ref),
         granted_by  = auth.uid(),
         updated_at  = now()
  returning e.expires_at into v_until;

  return jsonb_build_object('username', p_roblox_username, 'expires_at', v_until);
exception
  -- The unique index on payment_ref is what stops one webhook delivered twice
  -- from granting 120 days. It is not an error the owner needs to act on, so
  -- it reports what already happened rather than failing the call.
  when unique_violation then
    select expires_at into v_until from public.entitlements
     where payment_ref = btrim(p_payment_ref);
    return jsonb_build_object(
      'username', p_roblox_username, 'expires_at', v_until, 'already_applied', true);
end $$;

-- Ending one early. A refund, or a chargeback, or somebody who bought it and
-- then got themselves suspended. Not a delete: the row is the record of what
-- was sold, and deleting it loses the only trace that money changed hands.
create or replace function public.admin_revoke_level_up(p_roblox_username text)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $$
declare v_user uuid;
begin
  perform mintplaza.require_admin();
  select id into v_user from public.profiles
   where lower(username) = lower(btrim(p_roblox_username));
  if v_user is null then
    raise exception 'No player called %.', p_roblox_username using errcode = 'P0001';
  end if;
  update public.entitlements
     set source = 'refunded', expires_at = least(expires_at, now()), updated_at = now()
   where user_id = v_user and kind = 'level_up';
end $$;

-- Everyone who has ever had it, for the owner's own records.
create or replace function public.admin_level_ups()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_catalog as $$
declare v jsonb;
begin
  perform mintplaza.require_admin();
  select coalesce(jsonb_agg(x order by x->>'expires_at' desc), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'username', p.username,
      'roblox_user_id', p.roblox_user_id,
      'expires_at', e.expires_at,
      'active', e.expires_at > now() and e.source <> 'refunded',
      'source', e.source,
      'country', e.country,
      'payment_ref', e.payment_ref,
      'created_at', e.created_at
    ) x
    from public.entitlements e
    join public.profiles p on p.id = e.user_id
    where e.kind = 'level_up'
    limit 1000
  ) q;
  return v;
end $$;

revoke all on function public.admin_grant_level_up(text, int, text, text, text) from public, anon;
revoke all on function public.admin_revoke_level_up(text)                       from public, anon;
revoke all on function public.admin_level_ups()                                 from public, anon;
grant execute on function public.admin_grant_level_up(text, int, text, text, text) to authenticated;
grant execute on function public.admin_revoke_level_up(text)                       to authenticated;
grant execute on function public.admin_level_ups()                                 to authenticated;


-- ===========================================================================
-- ===========================================================================
-- Messaging: starting a thread, and the limits on it
--
-- The tables, the policies and is_participant() are all defined much earlier
-- in this file. What was missing is the part that makes them usable: there is
-- no INSERT policy on conversations or conversation_participants, so until now
-- nobody could start a conversation at all. Every player could read a thread
-- they were in and send to it; none of them could ever be in one.
--
-- ---------------------------------------------------------------------------
-- Why starting a thread is a function and not a policy
-- ---------------------------------------------------------------------------
--
-- The obvious fix is an insert policy on conversation_participants saying
-- `user_id = auth.uid()`. It is also a disaster: it says you may add YOURSELF
-- to a conversation, and it does not say WHICH one. Any signed-in player could
-- insert themselves into any existing thread by id and read two strangers'
-- entire private conversation, because the read policy would then honestly
-- report them as a participant.
--
-- So there is still no insert policy on either table, and this function is the
-- only way a row appears. It is SECURITY DEFINER, it decides both sides of the
-- thread itself, and nothing it writes comes from a caller-supplied id.
--
-- ---------------------------------------------------------------------------
-- Why it must be idempotent
-- ---------------------------------------------------------------------------
--
-- Tapping "Message" twice, or from two different listings by the same person,
-- must land in the SAME thread. Otherwise the inbox fills with duplicate
-- conversations with the same person, each holding part of the history, and
-- the feature is unusable within a week. The lookup below finds an existing
-- one-to-one thread before creating anything.
-- ===========================================================================
-- ===========================================================================

-- How many NEW people one account may open a thread with per day.
--
-- This is the anti-spam limit that matters. Messaging inside an existing
-- conversation is between two people who already agreed to talk; opening a
-- hundred new ones is how a scammer works a whole game's player list in an
-- afternoon. Ten is more than a real trader needs in a day and far fewer than
-- a spammer needs to be worth the effort.
create or replace function mintplaza.new_threads_per_day() returns int
  language sql immutable as $$ select 10 $$;

-- Burst and daily caps on messages themselves, across all conversations.
create or replace function mintplaza.messages_per_minute() returns int
  language sql immutable as $$ select 30 $$;

create or replace function mintplaza.messages_per_day() returns int
  language sql immutable as $$ select 600 $$;


-- ---------------------------------------------------------------------------
-- Open a conversation with somebody, or return the one you already have.
--
-- Takes a USERNAME rather than a user id, deliberately. A caller who can only
-- name people they can already see cannot enumerate the user table by walking
-- uuids, and the app has the username in hand everywhere this is offered.
-- ---------------------------------------------------------------------------
create or replace function public.start_conversation(
  p_username text,
  p_listing  uuid default null
)
returns uuid language plpgsql security definer
set search_path = public, pg_catalog as $$
declare
  v_me     uuid := auth.uid();
  v_them   uuid;
  v_id     uuid;
  v_today  int;
begin
  if v_me is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;

  -- The caller must be in good standing. A suspended account that could still
  -- open new threads would make suspension meaningless for the one behaviour
  -- it most often exists to stop.
  if not exists (select 1 from public.profiles where id = v_me and status = 'active') then
    raise exception 'Your account cannot start conversations.' using errcode = 'P0001';
  end if;

  select id into v_them from public.profiles
   where lower(username) = lower(btrim(p_username)) and status = 'active';
  if v_them is null then
    raise exception 'No player called %.', p_username using errcode = 'P0001';
  end if;

  if v_them = v_me then
    raise exception 'You cannot message yourself.' using errcode = 'P0001';
  end if;

  if not mintplaza.has_agreed(v_me) then
    raise exception 'Agree to the terms before messaging anybody.'
      using errcode = 'P0001',
            hint = 'The box appears the next time you open MintPlaza.';
  end if;

  -- No block check, because there is no blocking on this site. The gate that
  -- replaces it is the status check above: a restricted or suspended account
  -- cannot open a thread with anybody.

  -- ---- already talking? -------------------------------------------------
  --
  -- A one-to-one thread is one with exactly these two participants and no
  -- others. Counting is what makes that exact: a thread containing both of
  -- them plus a third person is a different conversation and must not be
  -- reused.
  select c.id into v_id
    from public.conversations c
   where exists (select 1 from public.conversation_participants p
                  where p.conversation_id = c.id and p.user_id = v_me)
     and exists (select 1 from public.conversation_participants p
                  where p.conversation_id = c.id and p.user_id = v_them)
     and (select count(*) from public.conversation_participants p
           where p.conversation_id = c.id) = 2
   order by c.last_message_at desc
   limit 1;

  if v_id is not null then
    return v_id;
  end if;

  -- ---- a new one, and the limit that guards it --------------------------
  select count(*) into v_today
    from public.conversations c
    join public.conversation_participants p on p.conversation_id = c.id
   where p.user_id = v_me
     and c.created_at > now() - interval '24 hours';

  if v_today >= mintplaza.new_threads_per_day() then
    raise exception 'You have started as many new conversations as one day allows.'
      using errcode = 'P0001',
            hint = 'This limit exists so nobody can message a whole game at once.';
  end if;

  -- The listing is kept only when it is real, so a deleted or forged id
  -- becomes a plain conversation rather than a dangling reference.
  insert into public.conversations (listing_id)
  values ((select l.id from public.trade_listings l where l.id = p_listing))
  returning id into v_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_id, v_me), (v_id, v_them);

  return v_id;
end $$;

revoke all on function public.start_conversation(text, uuid) from public, anon;
grant execute on function public.start_conversation(text, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Message rate limits, in a trigger so every route hits them.
--
-- The RLS policy on messages already decides WHO may send; this decides HOW
-- OFTEN. Keeping them apart matters: the policy is about permission and must
-- stay readable, and a rate limit expressed as a policy would make an ordinary
-- send fail with "new row violates row-level security", which tells the player
-- nothing about what they did.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_message_rate()
returns trigger language plpgsql security definer
set search_path = public, pg_catalog as $$
declare v_minute int; v_day int;
begin
  select count(*) into v_minute from public.messages
   where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if v_minute >= mintplaza.messages_per_minute() then
    raise exception 'You are sending messages too quickly.'
      using errcode = 'P0001', hint = 'Wait a moment and try again.';
  end if;

  select count(*) into v_day from public.messages
   where sender_id = new.sender_id and created_at > now() - interval '24 hours';
  if v_day >= mintplaza.messages_per_day() then
    raise exception 'You have sent as many messages as one day allows.'
      using errcode = 'P0001';
  end if;

  -- The server owns the clock and the status. A client that set created_at
  -- could sit outside its own rate window forever, and one that set status
  -- could post a message already marked hidden from moderation.
  new.created_at := now();
  new.status     := 'visible';
  new.edited_at  := null;
  return new;
end $$;

drop trigger if exists messages_rate on public.messages;
create trigger messages_rate
  before insert on public.messages
  for each row execute function public.enforce_message_rate();

-- The inbox sorts on last_message_at, so it has to move when a message lands.
-- A trigger rather than the sender's own update: there is no update policy on
-- conversations, and there should not be one — a participant who could write
-- to the conversation row could reorder somebody else's inbox.
create or replace function public.bump_conversation()
returns trigger language plpgsql security definer
set search_path = public, pg_catalog as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists messages_bump_conversation on public.messages;
create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation();

revoke all on function public.enforce_message_rate() from public, anon, authenticated;
revoke all on function public.bump_conversation()    from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- The inbox.
--
-- Returns the other person, the last thing said, and how much of it is unread.
-- Shaped as jsonb for the same reason board_listings() is: one round trip, and
-- the app reads exactly the keys named here rather than joining four tables in
-- TypeScript.
-- ---------------------------------------------------------------------------
create or replace function public.my_conversations()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_catalog as $$
declare v jsonb; v_me uuid := auth.uid();
begin
  if v_me is null then return '[]'::jsonb; end if;

  -- One row per CONVERSATION.
  --
  -- This used to join conversation_participants a second time on
  -- `user_id <> me` and read the name off it, which is only ever one row while
  -- every conversation holds exactly two people. A party of five produced four
  -- rows — the same chat listed four times in the inbox, under a different
  -- member's name each time, with the same unread badge on all of them.
  --
  -- So the other person is now a lateral lookup that cannot multiply the outer
  -- row, and it is only consulted for a direct message. A party titles itself.
  select coalesce(jsonb_agg(x order by x->>'last_message_at' desc), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'id', c.id,
      'kind', c.kind,
      'title', c.title,
      'member_count', (select count(*) from public.conversation_participants p
                        where p.conversation_id = c.id),
      'last_message_at', c.last_message_at,
      'listing_id', c.listing_id,
      'other_username', o.username,
      'other_display_name', o.display_name,
      'other_avatar_url', o.avatar_url,
      -- Presence is the profile's own setting to hide, and this respects it:
      -- an inbox that leaked "online now" for somebody who turned it off would
      -- be the one place the setting silently did not apply.
      'other_online', (not coalesce(o.hide_presence, false))
                      and o.last_seen_at > now() - interval '5 minutes',
      'last_body', (select m.body from public.messages m
                     where m.conversation_id = c.id and m.status = 'visible'
                     order by m.created_at desc limit 1),
      'last_sender_is_me', (select m.sender_id = v_me from public.messages m
                             where m.conversation_id = c.id and m.status = 'visible'
                             order by m.created_at desc limit 1),
      'unread', (select count(*) from public.messages m
                  where m.conversation_id = c.id
                    and m.status = 'visible'
                    and m.sender_id <> v_me
                    and (me.last_read_at is null or m.created_at > me.last_read_at))
    ) x
    from public.conversations c
    join public.conversation_participants me
      on me.conversation_id = c.id and me.user_id = v_me
    left join lateral (
      select pr.username, pr.display_name, pr.avatar_url,
             pr.hide_presence, pr.last_seen_at
      from public.conversation_participants them
      join public.profiles pr on pr.id = them.user_id
      where them.conversation_id = c.id and them.user_id <> v_me
      limit 1
    ) o on c.kind = 'direct'
    order by c.last_message_at desc
    limit 200
  ) q;
  return v;
end $$;


-- One thread, oldest first, with the other person's name attached so the
-- screen can title itself without a second call.
create or replace function public.conversation_thread(p_conversation uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_catalog as $$
declare v jsonb; v_other jsonb; v_members jsonb; v_pinned jsonb;
        v_kind text; v_title text; v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;

  -- SECURITY DEFINER means RLS is not consulted, so this check IS the access
  -- control. Without it the function would hand any signed-in player any
  -- conversation in the database by id.
  if not mintplaza.is_participant(p_conversation, v_me) then
    raise exception 'No such conversation.' using errcode = 'P0001';
  end if;

  -- Who else is here.
  --
  -- A direct message has exactly one other person and the screen titles itself
  -- with their name. A party has several and titles itself with its own, so
  -- `other` is left empty rather than picking one of five arbitrarily and
  -- labelling the whole chat with them.
  select kind, title into v_kind, v_title
    from public.conversations where id = p_conversation;

  if v_kind = 'direct' then
    select jsonb_build_object(
      'username', o.username,
      'display_name', o.display_name,
      'avatar_url', o.avatar_url,
      'online', (not coalesce(o.hide_presence, false))
                and o.last_seen_at > now() - interval '5 minutes'
    ) into v_other
    from public.conversation_participants p
    join public.profiles o on o.id = p.user_id
    where p.conversation_id = p_conversation and p.user_id <> v_me
    limit 1;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'username', o.username,
           'display_name', o.display_name,
           'avatar_url', o.avatar_url,
           'is_me', o.id = v_me
         ) order by (o.id = v_me) desc, o.username), '[]'::jsonb)
    into v_members
  from public.conversation_participants p
  join public.profiles o on o.id = p.user_id
  where p.conversation_id = p_conversation;

  -- The notice the party opened with, read separately so it can stay at the
  -- top of the screen once the chat has scrolled past it.
  select jsonb_build_object('id', m.id, 'body', m.body, 'created_at', m.created_at)
    into v_pinned
  from public.messages m
  where m.conversation_id = p_conversation and m.is_pinned and m.status = 'visible'
  order by m.created_at limit 1;

  -- Every message carries its sender. In a direct message the screen knows who
  -- "not me" is; in a party it does not, and an unattributed line in a group of
  -- six is the shape every impersonation takes.
  select coalesce(jsonb_agg(x order by x->>'created_at'), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'id', m.id,
      'body', m.body,
      'created_at', m.created_at,
      'mine', m.sender_id = v_me,
      'kind', m.kind,
      'pinned', m.is_pinned,
      'sender_username', s.username,
      'sender_display_name', s.display_name,
      'sender_avatar_url', s.avatar_url
    ) x
    from public.messages m
    join public.profiles s on s.id = m.sender_id
    where m.conversation_id = p_conversation and m.status = 'visible'
    order by m.created_at desc
    limit 200
  ) q;

  return jsonb_build_object(
    'kind', coalesce(v_kind, 'direct'),
    'title', v_title,
    'other', coalesce(v_other, '{}'::jsonb),
    'members', coalesce(v_members, '[]'::jsonb),
    'pinned', v_pinned,
    'messages', v);
end $$;


-- Mark everything up to now as read. Writes only the caller's own row, which
-- is why it can exist at all: there is no update policy on participants.
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $$
begin
  update public.conversation_participants
     set last_read_at = now()
   where conversation_id = p_conversation and user_id = auth.uid();
end $$;


-- How many threads have something new in them. For the badge on the rail.
create or replace function public.unread_count()
returns int language sql stable security definer
set search_path = public, pg_catalog as $$
  select count(distinct m.conversation_id)::int
    from public.messages m
    join public.conversation_participants me
      on me.conversation_id = m.conversation_id and me.user_id = auth.uid()
   where m.status = 'visible'
     and m.sender_id <> auth.uid()
     and (me.last_read_at is null or m.created_at > me.last_read_at);
$$;


revoke all on function public.my_conversations()               from public, anon;
revoke all on function public.conversation_thread(uuid)        from public, anon;
revoke all on function public.mark_conversation_read(uuid)     from public, anon;
revoke all on function public.unread_count()                   from public, anon;
grant execute on function public.my_conversations()            to authenticated;
grant execute on function public.conversation_thread(uuid)     to authenticated;
grant execute on function public.mark_conversation_read(uuid)  to authenticated;
grant execute on function public.unread_count()                to authenticated;


-- ===========================================================================
-- Level Up: the webhook's way in
--
-- admin_grant_level_up() calls require_admin(), which reads auth.uid() against
-- the allowlist. A payment webhook has no auth.uid() — it is a machine talking
-- to a machine — so it cannot use that function, and giving it a session would
-- mean keeping a signed-in admin credential on a server somewhere forever.
--
-- This is the same grant with a different gate: EXECUTE is revoked from anon
-- and authenticated and given only to service_role, whose key lives in the
-- deployment's environment and never reaches a browser. Anyone holding that
-- key can already read and write every table in the database, so this function
-- hands out nothing they did not already have — it just does the extending,
-- the country recording and the duplicate-payment refusal in the one place
-- those rules already live.
--
-- The HTTP side of this — the signature, the replay window, the body limit —
-- is in src/app/api/level-up/webhook/route.ts. None of it is trusted here.
-- This function assumes its caller is hostile and validates every argument.
-- ===========================================================================

create or replace function public.webhook_grant_level_up(
  p_username    text,
  p_payment_ref text,
  p_days        int  default 60,
  p_country     text default null,
  p_amount      numeric default null,
  p_currency    text default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_catalog as $$
declare v_user uuid; v_until timestamptz; v_existing timestamptz;
begin
  -- A payment reference is not optional here, unlike in the admin panel where
  -- a person is watching. It is the ONLY thing standing between a webhook
  -- delivered twice — which every payment processor does, by design, on
  -- retry — and a player receiving 120 days for one payment.
  if p_payment_ref is null or btrim(p_payment_ref) = '' then
    raise exception 'A payment reference is required.' using errcode = 'P0001';
  end if;

  if p_days is null or p_days < 1 or p_days > 3650 then
    raise exception 'Days must be between 1 and 3650.' using errcode = 'P0001';
  end if;

  -- Already applied? Say so and change nothing. This is the common case on a
  -- retry and is not an error: the processor wants a 200 so it stops retrying.
  select e.expires_at into v_existing from public.entitlements e
   where e.payment_ref = btrim(p_payment_ref);
  if v_existing is not null then
    return jsonb_build_object('applied', false, 'already_applied', true,
                              'expires_at', v_existing);
  end if;

  select id into v_user from public.profiles
   where lower(username) = lower(btrim(p_username));
  if v_user is null then
    -- A real situation rather than an attack: somebody paid on a checkout page
    -- with a username they have not yet signed in with. The payment is real
    -- and must not be silently swallowed, so this raises and the route turns
    -- it into a response the processor will retry and a human will see.
    raise exception 'No player called % has signed in yet.', p_username
      using errcode = 'P0001';
  end if;

  insert into public.entitlements as e
    (user_id, kind, expires_at, source, country, payment_ref)
  values
    (v_user, 'level_up', now() + make_interval(days => p_days), 'purchase',
     nullif(upper(btrim(coalesce(p_country, ''))), ''), btrim(p_payment_ref))
  on conflict (user_id) do update
     set expires_at  = greatest(now(), e.expires_at) + make_interval(days => p_days),
         source      = 'purchase',
         country     = coalesce(excluded.country, e.country),
         payment_ref = excluded.payment_ref,
         updated_at  = now()
  returning e.expires_at into v_until;

  return jsonb_build_object('applied', true, 'already_applied', false,
                            'expires_at', v_until, 'username', p_username);
exception
  -- Two deliveries racing each other. The unique index on payment_ref decides,
  -- and the loser reports what the winner wrote rather than failing.
  when unique_violation then
    select e.expires_at into v_until from public.entitlements e
     where e.payment_ref = btrim(p_payment_ref);
    return jsonb_build_object('applied', false, 'already_applied', true,
                              'expires_at', v_until);
end $$;

-- The whole security model of this function, in three lines.
revoke all on function public.webhook_grant_level_up(text, text, int, text, numeric, text)
  from public, anon, authenticated;
grant execute on function public.webhook_grant_level_up(text, text, int, text, numeric, text)
  to service_role;




/* ===========================================================================
 * ANNOUNCEMENTS
 * ===========================================================================
 *
 * One message from the owner, shown to everybody who opens the site, until it
 * expires or they dismiss it.
 *
 * Two dismissal states, because they mean different things to a player:
 *
 *   "Okay"            — read it, close it, show it again next visit. Held in
 *                       the browser's sessionStorage, so it never reaches here.
 *   "Don't show again" — never show me this one. That is a decision worth
 *                       keeping, so it is a row, and it follows the player to
 *                       their other devices.
 *
 * A signed-out visitor has no row to write, so the client also records the
 * dismissal in localStorage. That is the fallback, not the mechanism: for
 * anybody signed in, the row is what decides.
 * ------------------------------------------------------------------------- */

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  body        text not null check (char_length(btrim(body)) between 1 and 4000),
  -- Optional picture or clip. A URL rather than an upload: the owner already
  -- has somewhere to put a file, and a bucket to administer is a bucket to pay
  -- for, secure and clean up.
  -- Length is checked separately rather than as a regex repetition: Postgres
  -- caps those at 255, so {1,2000} is not a long URL, it is a constraint that
  -- parses at create time and throws on every insert.
  media_url   text check (
                media_url is null
                or (media_url ~ '^https://[^\s]+$' and char_length(media_url) <= 2000)),
  media_kind  text check (media_kind is null or media_kind in ('image', 'video')),
  -- An announcement with a picture must say which kind it is, or the client
  -- has to guess from the extension and guesses wrong on a CDN URL.
  constraint announcement_media_is_described
    check ((media_url is null) = (media_kind is null)),
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  constraint announcement_ends_after_it_starts check (expires_at > starts_at),
  -- Ending one early is what the panel does instead of deleting: a deleted
  -- announcement takes its dismissals with it, and anybody mid-read loses it
  -- under them.
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id) on delete set null
);

create index if not exists announcements_live_idx
  on public.announcements (is_active, starts_at desc, expires_at);

alter table public.announcements enable row level security;

-- Readable by everyone, including signed-out visitors, but only while it is
-- actually running. An announcement that has expired or been pulled is not
-- "hidden by the interface" — it is not served at all, so there is nothing to
-- read out of a network tab.
drop policy if exists announcements_read_live on public.announcements;
create policy announcements_read_live on public.announcements for select
  using (is_active and now() >= starts_at and now() < expires_at);

-- No insert, update or delete policy of any kind. Writing is the owner's,
-- through the SECURITY DEFINER functions below, which check is_admin()
-- themselves. A table with no write policy refuses every write from anon and
-- authenticated regardless of what the application sends.

create table if not exists public.announcement_dismissals (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  dismissed_at    timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.announcement_dismissals enable row level security;

drop policy if exists dismissals_own on public.announcement_dismissals;
create policy dismissals_own on public.announcement_dismissals for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

/**
 * The one announcement to show this viewer, or nothing.
 *
 * SECURITY DEFINER so a signed-out visitor gets an answer too: the policy above
 * already limits this to a live announcement, and the dismissal check is a
 * no-op when there is nobody to have dismissed it.
 *
 * Newest first, and exactly one. Two announcements stacked on top of each other
 * is not a feature, it is a thing nobody closes.
 */
create or replace function public.live_announcement()
returns table (
  id uuid, title text, body text,
  media_url text, media_kind text, expires_at timestamptz
)
language sql stable security definer set search_path = public, pg_catalog as $$
  select a.id, a.title, a.body, a.media_url, a.media_kind, a.expires_at
    from public.announcements a
   where a.is_active
     and now() >= a.starts_at
     and now() <  a.expires_at
     and not exists (
       select 1 from public.announcement_dismissals d
        where d.announcement_id = a.id
          and d.user_id = auth.uid())
   order by a.starts_at desc
   limit 1;
$$;

revoke all on function public.live_announcement() from public;
grant execute on function public.live_announcement() to anon, authenticated;

/** "Don't show again", for somebody who is signed in. */
create or replace function public.dismiss_announcement(p_announcement uuid)
returns void
language sql security definer set search_path = public, pg_catalog as $$
  insert into public.announcement_dismissals (announcement_id, user_id)
  select p_announcement, auth.uid()
   where auth.uid() is not null
  on conflict do nothing;
$$;

revoke all on function public.dismiss_announcement(uuid) from public, anon;
grant execute on function public.dismiss_announcement(uuid) to authenticated;

/**
 * Post an announcement, or edit one.
 *
 * Days rather than a date, because that is the question the owner is actually
 * answering — "how long should this be up" — and a date picker on a phone at
 * midnight is how an announcement ends up expiring yesterday.
 */
create or replace function public.admin_save_announcement(
  p_id uuid, p_title text, p_body text,
  p_media_url text, p_media_kind text, p_days int
)
returns uuid
language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_id uuid; v_days int;
begin
  perform mintplaza.require_admin();

  -- One day to a year. Zero would post something already expired; the cap is
  -- there because "3650" is a typo, not a plan.
  v_days := greatest(1, least(365, coalesce(p_days, 7)));

  if p_id is null then
    insert into public.announcements (title, body, media_url, media_kind, expires_at, created_by)
    values (btrim(p_title), btrim(p_body),
            nullif(btrim(coalesce(p_media_url, '')), ''),
            nullif(btrim(coalesce(p_media_kind, '')), ''),
            now() + make_interval(days => v_days), auth.uid())
    returning id into v_id;
  else
    update public.announcements set
      title      = btrim(p_title),
      body       = btrim(p_body),
      media_url  = nullif(btrim(coalesce(p_media_url, '')), ''),
      media_kind = nullif(btrim(coalesce(p_media_kind, '')), ''),
      -- Editing restarts the clock from now, which is what "make it run for
      -- five days" means when you are looking at it on day three.
      starts_at  = least(starts_at, now()),
      expires_at = now() + make_interval(days => v_days)
     where id = p_id
    returning id into v_id;
  end if;

  return v_id;
end $$;

revoke all on function public.admin_save_announcement(uuid, text, text, text, text, int)
  from public, anon;
grant execute on function public.admin_save_announcement(uuid, text, text, text, text, int)
  to authenticated;

/** Pull one down early, or put it back up. */
create or replace function public.admin_set_announcement_active(p_id uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  perform mintplaza.require_admin();
  update public.announcements set is_active = coalesce(p_active, false) where id = p_id;
end $$;

revoke all on function public.admin_set_announcement_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_announcement_active(uuid, boolean) to authenticated;

/**
 * Every announcement, for the panel — including expired and pulled ones, which
 * the read policy above deliberately hides from everybody else.
 */
create or replace function public.admin_announcements()
returns table (
  id uuid, title text, body text, media_url text, media_kind text,
  starts_at timestamptz, expires_at timestamptz, is_active boolean,
  created_at timestamptz, dismissals bigint, live boolean
)
language plpgsql stable security definer set search_path = public, pg_catalog as $$
begin
  perform mintplaza.require_admin();
  return query
  select a.id, a.title, a.body, a.media_url, a.media_kind,
         a.starts_at, a.expires_at, a.is_active, a.created_at,
         (select count(*) from public.announcement_dismissals d
           where d.announcement_id = a.id) as dismissals,
         (a.is_active and now() >= a.starts_at and now() < a.expires_at) as live
    from public.announcements a
   order by a.created_at desc
   limit 50;
end $$;

revoke all on function public.admin_announcements() from public, anon;
grant execute on function public.admin_announcements() to authenticated;


-- ===========================================================================
-- ===========================================================================
-- Parties — the group chat a finalised deal opens
--
-- ---------------------------------------------------------------------------
-- Why this is the same table as a direct message
-- ---------------------------------------------------------------------------
--
-- `conversations` + `conversation_participants` was already an N-party model:
-- a conversation is a row, and everybody in it is a row in the join table.
-- Nothing about it assumed two people except the functions that READ it, and
-- those assumed it hard — see my_conversations() below, which joined one row
-- per other participant and would have listed a party of five in the inbox
-- four times, each under a different member's name.
--
-- So a party is not a new kind of object. It is a conversation with a name, a
-- known size, and the listing it came out of.
-- ===========================================================================
-- ===========================================================================

alter table public.conversations
  add column if not exists kind  text not null default 'direct',
  add column if not exists title text,
  -- Which recruitment post opened it. `listing_id` above is a TRADE listing
  -- and means something else; a party comes from the service board. Separate
  -- columns because they point at different tables and a single nullable one
  -- would have to be read with a second field saying which it meant.
  add column if not exists service_listing_id uuid;

do $$ begin
  alter table public.conversations
    add constraint conversations_party_listing_fk
    foreign key (service_listing_id) references public.service_listings(id)
    on delete set null;
exception when duplicate_object then null; end $$;

select mintplaza.add_check('public.conversations', 'conversations_kind_known',
  $c$kind in ('direct','party')$c$);
select mintplaza.add_check('public.conversations', 'conversations_title_length',
  $c$title is null or char_length(title) between 1 and 120$c$);

-- A party has exactly one of these open at a time, so finalising twice cannot
-- leave two chats with the same people in them wondering which is live.
create unique index if not exists conversations_one_party_per_listing
  on public.conversations (service_listing_id) where kind = 'party';

-- ---------------------------------------------------------------------------
-- The pinned notice, and why a player must not be able to write one
-- ---------------------------------------------------------------------------
--
-- A party opens with a pinned message at the top. It is posted by the site,
-- not by a person, and it is the one message in the thread that carries any
-- authority — which is exactly what makes it worth forging. "MintPlaza says:
-- send your items first and the host will send back" pinned above a group of
-- six is the most effective scam this site could host.
--
-- The trigger below cannot tell the difference: auth.uid() is the same inside
-- a SECURITY DEFINER function as outside it. Column privileges can. The
-- application only ever inserts conversation_id, sender_id and body, so
-- `authenticated` is granted those three columns and no others — a player
-- naming `kind` or `is_pinned` in an INSERT is refused by Postgres before any
-- policy runs, and the defaults stand.
alter table public.messages
  add column if not exists kind      text not null default 'chat',
  add column if not exists is_pinned boolean not null default false;

select mintplaza.add_check('public.messages', 'messages_kind_known',
  $c$kind in ('chat','system')$c$);

create index if not exists messages_pinned_idx
  on public.messages (conversation_id) where is_pinned;

-- A system message is the site talking, so it does not spend the poster's
-- daily allowance. Without this, opening a party would charge the host for a
-- message they did not write — and a host who had been chatting all day would
-- have the party open with no notice in it at all.
create or replace function public.enforce_message_rate()
returns trigger language plpgsql security definer
set search_path = public, pg_catalog as $$
declare v_minute int; v_day int;
begin
  if new.kind = 'system' then
    new.created_at := now();
    new.status     := 'visible';
    new.edited_at  := null;
    return new;
  end if;

  select count(*) into v_minute from public.messages
   where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if v_minute >= mintplaza.messages_per_minute() then
    raise exception 'You are sending messages too quickly.'
      using errcode = 'P0001', hint = 'Wait a moment and try again.';
  end if;

  select count(*) into v_day from public.messages
   where sender_id = new.sender_id and created_at > now() - interval '24 hours';
  if v_day >= mintplaza.messages_per_day() then
    raise exception 'You have sent as many messages as one day allows.'
      using errcode = 'P0001';
  end if;

  -- The server owns the clock and the status. A client that set created_at
  -- could sit outside its own rate window forever, and one that set status
  -- could post a message already marked hidden from moderation.
  new.created_at := now();
  new.status     := 'visible';
  new.edited_at  := null;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- What the pinned notice says
-- ---------------------------------------------------------------------------
--
-- In a function rather than written into finalize_deal, so there is one place
-- to change it and no chance of two parties opening with different text.
--
-- It is not a parameter. If the caller passed the text, a player calling the
-- RPC directly would choose what the site appears to say to five people who
-- just agreed to trade with them.
--
-- The safety line is not padding. Every one of these deals needs a private
-- server, "free private server" is the single most common bait in Roblox
-- scams, and the people reading this are thirteen.
create or replace function mintplaza.party_pinned_message() returns text
language sql immutable as $$
  select
    'Welcome — this chat opened because the deal was finalised. Everyone here said yes to it.' || E'\n\n' ||
    'Need a private server? Beebom keeps up-to-date lists of free private server links for most Roblox games — search "Beebom free private server" and your game name.' || E'\n\n' ||
    'Two rules that keep this fun: nobody pays real money or Robux for a private server link, and nobody sends items, passwords or logins first. If somebody in here asks for any of that, use Report and leave.'
$$;

-- ---------------------------------------------------------------------------
-- Finalising a deal
--
-- One function, because these five things are one event: the stage moves, the
-- party opens, everybody who agreed is put in it, the notice is pinned, and
-- the post records that it happened. Half of that having run is not a state
-- the site has a screen for.
--
-- Idempotent on purpose. The finalise button sits behind an ad, and an ad is
-- the least reliable thing on any page — it times out, it is blocked, the tab
-- is backgrounded, the player taps twice. Every one of those ends in a retry,
-- and a retry must land the player in the party that already exists rather
-- than opening a second one with the same six people in it.
-- ---------------------------------------------------------------------------

alter table public.service_listings
  add column if not exists finalized_at       timestamptz,
  add column if not exists finalize_ad_shown  boolean not null default false;

create or replace function public.finalize_deal(
  p_listing   uuid,
  p_ad_shown  boolean default false
) returns jsonb
language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_me      uuid := auth.uid();
  v_author  uuid;
  v_game    text;
  v_short   text;
  v_conv    uuid;
  v_agreed  int;
  v_members int;
  v_title   text;
begin
  if v_me is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;

  select author_id, game_slug into v_author, v_game
    from public.service_listings where id = p_listing;
  if v_author is null then
    raise exception 'That post no longer exists.' using errcode = 'P0001';
  end if;
  if v_author <> v_me then
    raise exception 'Only the player who posted this can finalise it.'
      using errcode = 'P0001';
  end if;

  -- Already done. Hand back the same party rather than refusing, because the
  -- caller retrying is the normal case here, not an error.
  select id, title into v_conv, v_title from public.conversations
   where service_listing_id = p_listing and kind = 'party';
  if v_conv is not null then
    select count(*) into v_members from public.conversation_participants
     where conversation_id = v_conv;
    return jsonb_build_object('conversation_id', v_conv, 'title', v_title,
                              'member_count', v_members, 'already_open', true);
  end if;

  select count(*) into v_agreed from public.service_picks
   where listing_id = p_listing and reply = 'agreed';
  if v_agreed = 0 then
    raise exception 'Nobody has said yes yet.'
      using errcode = 'P0001',
            hint = 'Wait for the players you picked to agree, then finalise.';
  end if;

  select short_name into v_short from public.games where slug = v_game;
  v_title := left(coalesce(v_short, 'MintPlaza') || ' · '
                  || (v_agreed + 1) || ' players', 120);

  insert into public.conversations (kind, title, service_listing_id)
  values ('party', v_title, p_listing)
  returning id into v_conv;

  -- The host and everybody who agreed. The host is in it by definition: a
  -- party they opened and cannot speak in would be a bug with a screen.
  insert into public.conversation_participants (conversation_id, user_id)
  select v_conv, v_me
  union
  select v_conv, sp.user_id
    from public.service_picks sp
   where sp.listing_id = p_listing and sp.reply = 'agreed'
  on conflict do nothing;

  insert into public.messages (conversation_id, sender_id, body, kind, is_pinned)
  values (v_conv, v_me, mintplaza.party_pinned_message(), 'system', true);

  update public.service_listings
     set stage = 'locked',
         finalized_at = now(),
         finalize_ad_shown = coalesce(p_ad_shown, false)
   where id = p_listing;

  select count(*) into v_members from public.conversation_participants
   where conversation_id = v_conv;

  return jsonb_build_object('conversation_id', v_conv, 'title', v_title,
                            'member_count', v_members, 'already_open', false);
end $$;

revoke all on function public.finalize_deal(uuid, boolean) from public, anon;
grant execute on function public.finalize_deal(uuid, boolean) to authenticated;
revoke all on function mintplaza.party_pinned_message() from public, anon;
grant execute on function mintplaza.party_pinned_message() to authenticated;


-- ===========================================================================
-- ===========================================================================
-- Table privileges — the layer underneath RLS
--
-- ---------------------------------------------------------------------------
-- Why RLS on its own was not enough
-- ---------------------------------------------------------------------------
--
-- Supabase grants `anon` and `authenticated` full table privileges on
-- everything in `public` by default, and exposes the whole schema over
-- PostgREST with a key that ships inside the browser. Row-level security is
-- therefore the only thing standing between a player and a direct write — and
-- an RLS policy decides WHICH ROWS you may touch, never WHICH COLUMNS.
--
-- Every policy in this file that says `using (user_id = auth.uid())` was read,
-- correctly, as "you may only change your own things". What it actually says
-- is "you may change ANYTHING ABOUT your own things", and the difference is
-- the whole site's rules. Demonstrated against a real Postgres, as an ordinary
-- signed-in player, with nothing but the public key:
--
--   update trade_listings set created_at = now() - interval '48 hours'
--   -> listing_allowance() went from used=1 back to used=0.
--
-- That is the posting limit — four a day, the rule the board depends on —
-- switched off with one request. The same row also took expires_at =
-- now() + 10 years (a listing that never dies) and bumped_at in the future
-- (permanent top of the board, with the six-hour cooldown never consulted).
--
--   update profiles set status = 'active'   -> a suspended account un-bans itself,
--                                              and status='active' is exactly what
--                                              the posting policies check.
--   update profiles set username = 'alice'  -> wear a trusted trader's name on a
--                                              site where strangers hand each other
--                                              valuable items.
--   update profiles set roblox_user_id = …  -> the "immutable, one Roblox account is
--                                              one MintPlaza account" identity, edited.
--
-- None of that goes near the application. post_trade_listing(), save_profile()
-- and set_display_name() validate carefully and were never the way in.
--
-- ---------------------------------------------------------------------------
-- The rule from here
-- ---------------------------------------------------------------------------
--
-- A table the application only ever writes through a SECURITY DEFINER function
-- gets no write privilege at all. The functions are unaffected — they run as
-- their owner — and the triggers still fire, because a trigger fires for
-- whoever writes. Reads are untouched: SELECT stays where it was and RLS keeps
-- deciding them, which is tested at length in scripts/pg-rls-test.sql.
--
-- Column privileges rather than row policies are the right tool here, and they
-- are checked against the columns named in the statement, so a BEFORE trigger
-- may still stamp a column the writer may not name.
-- ===========================================================================
-- ===========================================================================

-- A signed-out visitor writes nothing, anywhere. SELECT is left alone, so the
-- public board, profiles and the live announcement still read exactly as
-- before.
revoke insert, update, delete, truncate on all tables in schema public from anon;

-- Written only from inside post_trade_listing(), bump_listing(),
-- cancel_trade_listing(), save_profile(), set_display_name(),
-- set_hide_presence(), ensure_profile() and delete_my_account(). Verified
-- against the application: no .from("profiles"), .from("trade_listings") or
-- .from("listing_sides") anywhere in src/ performs an insert, update or
-- delete.
revoke insert, update, delete, truncate on
  public.profiles,
  public.trade_listings,
  public.listing_sides
from authenticated;

-- The recruitment board is different: the app does write it directly, and
-- should — posting and deleting a post are ordinary row operations the
-- policies already judge correctly. The only UPDATE it performs is moving the
-- post through its stages, so that is the only column it may name. expires_at,
-- vote_cap and slots are the author's to set when the row is created and not
-- afterwards.
revoke update on public.service_listings from authenticated;
grant update (stage) on public.service_listings to authenticated;

-- Messages: the three columns the application actually sends, and no others.
--
-- `kind` and `is_pinned` decide whether a message renders as somebody talking
-- or as the site talking, pinned above the thread. A player who could name
-- those in an INSERT could pin "MintPlaza says: send your items first" over a
-- party of six who have just agreed to trade with them, and it would look
-- exactly like the real notice. No policy can stop that — a policy picks rows,
-- not columns — so the privilege does.
revoke insert on public.messages from authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;
