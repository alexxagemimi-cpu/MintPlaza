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

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";   -- fuzzy item-name search

-- ---------------------------------------------------------------------------
-- Tuning knobs. Changing a rule means changing it here, in one place.
-- ---------------------------------------------------------------------------
create schema if not exists mintplaza;

create or replace function mintplaza.listing_window() returns interval
  language sql immutable as $$ select interval '3 hours' $$;

create or replace function mintplaza.listings_per_window() returns int
  language sql immutable as $$ select 3 $$;

-- Second cap the written spec omits. Three listings per three hours is 24 a
-- day, and listings live seven days, so without this one account could hold
-- 168 live listings while never breaking the stated rule.
create or replace function mintplaza.max_active_per_game() returns int
  language sql immutable as $$ select 10 $$;

create or replace function mintplaza.listing_lifetime() returns interval
  language sql immutable as $$ select interval '7 days' $$;


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
  expires_at   timestamptz not null default now() + interval '7 days',
  -- One free "still available" refresh a day. Moves the listing up without
  -- consuming a slot, so nobody has to repost to stay visible.
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
-- A true rolling window: count listings CREATED in the trailing three hours.
-- Counting creations rather than live listings is deliberate — it means
-- cancelling a listing does not hand back a slot, so create/cancel/create
-- cannot cycle past the limit.
-- ---------------------------------------------------------------------------

create or replace function public.listing_allowance(p_game text)
returns table (
  used           int,
  remaining      int,
  next_slot_at   timestamptz,
  active_in_game int,
  active_cap     int
)
language sql stable security definer set search_path = public, pg_catalog as $$
  with me as (select auth.uid() as uid),
  recent as (
    select created_at
    from public.trade_listings
    where user_id = (select uid from me)
      and created_at > now() - mintplaza.listing_window()
    order by created_at desc
    limit mintplaza.listings_per_window()
  ),
  live as (
    select count(*)::int as n
    from public.trade_listings
    where user_id = (select uid from me)
      and game_slug = p_game and status = 'active'
  )
  select
    (select count(*)::int from recent),
    greatest(mintplaza.listings_per_window() - (select count(*)::int from recent), 0),
    case
      when (select count(*) from recent) >= mintplaza.listings_per_window()
      then (select min(created_at) from recent) + mintplaza.listing_window()
      else null
    end,
    (select n from live),
    mintplaza.max_active_per_game();
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
begin
  perform 1 from public.profiles where id = new.user_id for update;

  select count(*) into v_recent
  from public.trade_listings
  where user_id = new.user_id
    and created_at > now() - mintplaza.listing_window();

  if v_recent >= mintplaza.listings_per_window() then
    select min(created_at) + mintplaza.listing_window() into v_next
    from (
      select created_at from public.trade_listings
      where user_id = new.user_id and created_at > now() - mintplaza.listing_window()
      order by created_at desc limit mintplaza.listings_per_window()
    ) w;
    raise exception using
      errcode = 'P0001',
      message = format('All %s listing slots are in use for this window.',
                       mintplaza.listings_per_window()),
      detail  = format('next_slot_at=%s', v_next),
      hint    = 'A slot frees up three hours after the listing that used it.';
  end if;

  select count(*) into v_active
  from public.trade_listings
  where user_id = new.user_id and game_slug = new.game_slug and status = 'active';

  if v_active >= mintplaza.max_active_per_game() then
    raise exception using
      errcode = 'P0001',
      message = format('You already have %s active listings in this game.',
                       mintplaza.max_active_per_game()),
      hint    = 'Complete or cancel one before posting another.';
  end if;

  -- Server owns every timestamp on the row.
  new.created_at := now();
  new.bumped_at  := now();
  new.expires_at := now() + mintplaza.listing_lifetime();
  new.status     := 'active';
  return new;
end $$;

drop trigger if exists trade_listings_enforce_limits on public.trade_listings;
create trigger trade_listings_enforce_limits
  before insert on public.trade_listings
  for each row execute function public.enforce_listing_limits();

-- One bump per listing per day, and only by its owner.
create or replace function public.bump_listing(p_listing uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_new timestamptz;
begin
  update public.trade_listings
     set bumped_at = now(), updated_at = now()
   where id = p_listing
     and user_id = auth.uid()
     and status = 'active'
     and bumped_at < now() - interval '24 hours'
  returning bumped_at into v_new;

  if v_new is null then
    raise exception 'This listing cannot be bumped yet.' using errcode = 'P0001';
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

create or replace function public.is_participant(p_conversation uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation and user_id = p_user
  );
$$;


-- ===========================================================================
-- Safety
-- ===========================================================================

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

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
create or replace function public.is_moderator()
returns boolean language sql stable as $$
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
alter table public.blocks                  enable row level security;
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
  using (public.is_participant(id, auth.uid()) or public.is_moderator());

drop policy if exists participants_read on public.conversation_participants;
create policy participants_read on public.conversation_participants for select
  using (public.is_participant(conversation_id, auth.uid()) or public.is_moderator());

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select
  using (
    (status = 'visible' and public.is_participant(conversation_id, auth.uid()))
    or public.is_moderator()
  );
drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_participant(conversation_id, auth.uid())
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
    -- Cannot message across a block, in either direction.
    and not exists (
      select 1 from public.conversation_participants cp
      join public.blocks b
        on (b.blocker_id = cp.user_id and b.blocked_id = auth.uid())
        or (b.blocker_id = auth.uid() and b.blocked_id = cp.user_id)
      where cp.conversation_id = messages.conversation_id
    )
  );

-- Blocks: yours alone, and never visible to the person blocked.
drop policy if exists blocks_own on public.blocks;
create policy blocks_own on public.blocks for all
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

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
   '{Fruit,Sword,Gun,"Fighting style",Accessory,Material}',
   '#D9542B', '/games/blox-fruits.jpg', 1),

  ('grow-a-garden', 'Grow a Garden', 'Garden',
   'Pet, seed and sheckle trades, plus getting a shout when the weather worth planting for actually arrives.',
   '{trades,inventory,activities,help}',
   '{"Weather window","Mutation run",Event,"Group session"}',
   '{Crop,Seed,Pet,Gear,Cosmetic}',
   '#5BAE3A', '/games/grow-a-garden.jpg', 2),

  ('adopt-me', 'Adopt Me!', 'Adopt Me',
   'Pet trades, and finding people who will actually sit through a neon or mega project with you.',
   '{trades,inventory,help,activities}',
   '{"Neon project","Mega project","Aging help","Task run",Event}',
   '{Pet,Egg,Vehicle,Toy,Stroller,Food}',
   '#E8B23A', '/games/adopt-me.jpg', 3),

  ('pet-simulator-99', 'Pet Simulator 99', 'PS99',
   'Huge, Titanic and Exclusive trades, value checks before you accept, and people to run a clan with.',
   '{trades,inventory,help,activities}',
   '{Clan,Event,"Group session"}',
   '{Pet,Egg,Enchant,Charm,Item}',
   '#D9538F', '/games/pet-simulator-99.jpg', 4),

  ('royale-high', 'Royale High', 'Royale High',
   'Halo and set trades, diamond grinding company, and partners for the quests nobody wants to do alone.',
   '{trades,inventory,activities,help}',
   '{"Quest run","Campus activity","Diamond grind","Seasonal event"}',
   '{Halo,Set,Accessory,Skirt,Heels,Wings}',
   '#D98BC4', '/games/royale-high.jpg', 5),

  ('creatures-of-sonaria', 'Creatures of Sonaria', 'Sonaria',
   'Creature trades where the details decide the value, and packs for the missions built to need a group.',
   '{trades,inventory,activities,help}',
   '{"Pack mission","Daily mission","Weekly mission","Monthly mission","Event mission"}',
   '{Creature,Plushie,Token,Palette,Material,Skin}',
   '#4E8FB5', '/games/creatures-of-sonaria.jpg', 6)
on conflict (slug) do update set
  name = excluded.name, short_name = excluded.short_name, blurb = excluded.blurb,
  modules = excluded.modules, activity_kinds = excluded.activity_kinds,
  item_categories = excluded.item_categories, hue = excluded.hue,
  art = excluded.art, sort_order = excluded.sort_order;

-- Murder Mystery 2 was in an earlier draft by mistake and is not a launch game.
delete from public.games where slug = 'murder-mystery-2';


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
revoke all on function public.is_participant(uuid, uuid) from public, anon, authenticated;

grant execute on function public.ensure_profile()        to authenticated;
grant execute on function public.bump_listing(uuid)      to authenticated;
grant execute on function public.listing_allowance(text) to authenticated;

-- expire_listings is a scheduled job, handle_new_user and
-- enforce_listing_limits are trigger bodies, and is_participant is a helper
-- used inside policies. None should be reachable over the REST API, so none
-- of them are granted to anybody.


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

alter table public.service_listings
  drop constraint if exists service_listings_vote_cap_check,
  drop constraint if exists service_listings_slots_check,
  drop constraint if exists service_listings_window_check;

alter table public.service_listings
  add constraint service_listings_vote_cap_check
    check (vote_cap is null or (vote_cap between 1 and 500)),
  add constraint service_listings_slots_check
    check (slots is null or (slots between 1 and 18)),
  -- Ten minutes is the shortest post anybody can answer in time; four hours the
  -- longest that can still honestly be called live.
  add constraint service_listings_window_check
    check (expires_at > created_at + interval '10 minutes'
       and expires_at <= created_at + interval '4 hours');

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

alter table public.reports drop constraint if exists reports_evidence_url_check;
alter table public.reports add constraint reports_evidence_url_check
  check (evidence_url is null
         or (length(evidence_url) <= 500 and evidence_url ~* '^https?://'));

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

alter table public.games drop constraint if exists games_explore_tabs_check;
alter table public.games
  add constraint games_explore_tabs_check check (public.valid_explore_tabs(explore_tabs));

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

alter table public.service_templates drop constraint if exists service_templates_refs_check;
alter table public.service_templates
  add constraint service_templates_refs_check check (public.valid_service_refs(refs));

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

do $$ begin
  alter table public.profiles
    add constraint profiles_game_tags_check check (cardinality(game_tags) <= 8);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_tags_check check (cardinality(tags) <= 6);
exception when duplicate_object then null; end $$;


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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', true, 3145728,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
-- No SVG. An SVG is a document that can run script, and this bucket is served
-- from the same origin as everything else.

do $$ begin
  create policy "proof pictures are readable" on storage.objects
    for select using (bucket_id = 'proofs');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "upload into your own proof folder" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'proofs'
                and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "delete your own proof pictures" on storage.objects
    for delete to authenticated
    using (bucket_id = 'proofs'
           and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;


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

alter table public.inventory_entries drop constraint if exists inventory_item_slug_shape;
alter table public.inventory_entries add constraint inventory_item_slug_shape
  check (item_id is null or mintplaza.is_item_slug(item_id));

alter table public.listing_sides drop constraint if exists listing_sides_item_slug_shape;
alter table public.listing_sides add constraint listing_sides_item_slug_shape
  check (item_id is null or mintplaza.is_item_slug(item_id));

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

do $$ begin
  create type mintplaza.listing_row as (
    listing_id uuid, game_slug text,
    user_id uuid, username text, display_name text,
    avatar_url text, online boolean, deals int,
    note text, created_at timestamptz, bumped_at timestamptz,
    expires_at timestamptz, bumpable boolean, sides jsonb
  );
exception when duplicate_object then null; end $$;

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

create or replace function mintplaza.hidden(p_other uuid)
returns boolean language sql stable set search_path = public, pg_catalog as $$
  select exists (
    select 1 from public.blocks b
     where (b.blocker_id = auth.uid() and b.blocked_id = p_other)
        or (b.blocker_id = p_other and b.blocked_id = auth.uid()));
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

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

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
   '{Fish,"Rod Skins",Boats,Bobbers,Gliders,Relics}',
   '#127D91', '/games/fisch.jpg', 7),

  ('gag2', 'Grow a Garden 2', 'GAG2',
   'Plant, grow offline, sell for Sheckles and defend against night raids. Items move by one-way Mailbox gift — there is no protected trade window in this game.',
   '{trades,inventory,activities,help}',
   '{Crew}',
   '{Seed,Crop,Pet,Egg,Gear,Prop,Crate,"Mutation Item"}',
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

alter table public.service_listings drop constraint if exists service_listings_ref_id_check;
alter table public.service_listings add constraint service_listings_ref_id_check
  check (ref_id is null or length(ref_id) <= 80);


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
drop policy if exists service_votes_delete_own on public.service_votes;
create policy service_votes_delete_own on public.service_votes for delete
  using (
    user_id = auth.uid()
    and not exists (select 1 from public.service_picks p
                     where p.listing_id = listing_id and p.user_id = auth.uid())
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
drop policy if exists service_comments_insert_voter on public.service_comments;
create policy service_comments_insert_voter on public.service_comments for insert
  with check (
    author_id = auth.uid()
    and (
      exists (select 1 from public.service_votes v
               where v.listing_id = listing_id and v.user_id = auth.uid())
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
       and not exists (
         select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = l.author_id)
             or (b.blocker_id = l.author_id and b.blocked_id = auth.uid()))
     order by l.created_at desc
     limit 100
  ) q;
$$;

revoke all on function public.board_listings(text) from public, anon;
grant execute on function public.board_listings(text) to authenticated, anon;


-- ---------------------------------------------------------------------------
-- Value history
--
-- The panel can put an item's money fields back to an earlier version, which
-- needs somewhere to have recorded them. Written by a trigger rather than by
-- the panel, so a value changed by any route is still recoverable.
-- ---------------------------------------------------------------------------

create table if not exists public.item_value_history (
  id              bigserial primary key,
  item_id         uuid not null references public.game_items(id) on delete cascade,
  value_physical  numeric,
  value_permanent numeric,
  demand          numeric,
  beli            numeric,
  robux           numeric,
  changed_by      uuid references public.profiles(id) on delete set null,
  changed_at      timestamptz not null default now()
);

create index if not exists item_value_history_item_idx
  on public.item_value_history (item_id, changed_at desc);

alter table public.item_value_history enable row level security;
drop policy if exists item_value_history_read on public.item_value_history;
create policy item_value_history_read on public.item_value_history for select
  using (public.is_admin());
-- No write policy: the trigger below is the only writer.

create or replace function public.record_item_value()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_num text[] := array['valuePhysical','valuePermanent','demand','beli','robux'];
        k text;
        changed boolean := false;
begin
  -- Only money moved matters. A rename or a category edit is not a value
  -- change and should not fill the history with rows nobody can revert to.
  foreach k in array v_num loop
    if (old.attributes->>k) is distinct from (new.attributes->>k) then
      changed := true;
    end if;
  end loop;
  if not changed then return new; end if;

  insert into public.item_value_history
    (item_id, value_physical, value_permanent, demand, beli, robux, changed_by)
  values (
    old.id,
    nullif(old.attributes->>'valuePhysical','')::numeric,
    nullif(old.attributes->>'valuePermanent','')::numeric,
    nullif(old.attributes->>'demand','')::numeric,
    nullif(old.attributes->>'beli','')::numeric,
    nullif(old.attributes->>'robux','')::numeric,
    auth.uid()
  );
  return new;
exception
  -- History is a convenience. A row that cannot be recorded — a value that was
  -- written as text by some earlier route, say — must not block the edit
  -- itself, or one malformed attribute would make an item uneditable forever.
  when others then
    raise notice 'value history skipped for %: %', old.id, sqlerrm;
    return new;
end $$;

drop trigger if exists game_items_value_history on public.game_items;
create trigger game_items_value_history
  before update on public.game_items
  for each row execute function public.record_item_value();

revoke all on function public.record_item_value() from public, anon, authenticated;


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
set search_path = mintplaza, public, pg_catalog as $$
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

create or replace function public.console_unlock(p_passcode text)
returns text language plpgsql security definer
set search_path = mintplaza, public, pg_catalog as $$
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
set search_path = mintplaza, public, pg_catalog as $$
  select public.is_admin() and exists (
    select 1 from mintplaza.console_session
     where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
       and expires_at > now()
  );
$$;

create or replace function public.console_lock(p_token text)
returns void language sql security definer
set search_path = mintplaza, public, pg_catalog as $$
  delete from mintplaza.console_session
   where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

/**
 * Does this search phrase open the panel?
 *
 * The panel has no link anywhere in the interface. Typing the phrase in search
 * is how the owner reaches it, and for everybody else the phrase matches
 * nothing, so the panel does not exist as far as search is concerned.
 */
create or replace function public.console_phrase_matches(p_phrase text)
returns boolean language sql stable security definer
set search_path = public, pg_catalog as $$
  select public.is_admin()
     and lower(btrim(coalesce(p_phrase, ''))) in ('control panel', 'console', 'studio', 'admin');
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
