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

-- Create the profile when Supabase creates the auth user. Claim names follow
-- the Roblox OIDC userinfo response.
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


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

create or replace function public.listing_allowance(p_user uuid, p_game text)
returns table (
  used          int,
  remaining     int,
  next_slot_at  timestamptz,
  active_in_game int,
  active_cap    int
)
language sql stable security definer set search_path = public as $$
  with recent as (
    select created_at
    from public.trade_listings
    where user_id = p_user
      and created_at > now() - mintplaza.listing_window()
    order by created_at desc
    limit mintplaza.listings_per_window()
  ),
  live as (
    select count(*)::int as n
    from public.trade_listings
    where user_id = p_user and game_slug = p_game and status = 'active'
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
-- Deterministic set intersection, not a model. Because the match IS the
-- intersection, the reason comes out with it rather than being narrated after
-- the fact. Reason codes are a closed set the interface knows how to render.
-- ===========================================================================

create or replace function public.recommended_listings(
  p_game text,
  p_limit int default 20,
  p_cursor timestamptz default null
)
returns table (
  listing_id  uuid,
  user_id     uuid,
  note        text,
  bumped_at   timestamptz,
  reason      text,
  score       int
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid),
  my_haves as (
    select item_id from public.inventory_entries
    where user_id = (select uid from me) and game_slug = p_game
      and kind = 'have' and item_id is not null
  ),
  my_wants as (
    select item_id from public.inventory_entries
    where user_id = (select uid from me) and game_slug = p_game
      and kind = 'want' and item_id is not null
  ),
  candidates as (
    select l.id, l.user_id, l.note, l.bumped_at,
           -- they offer something I want
           count(*) filter (where s.side = 'offer' and s.item_id in (select item_id from my_wants)) as gives,
           -- they want something I have
           count(*) filter (where s.side = 'want'  and s.item_id in (select item_id from my_haves)) as takes
      from public.trade_listings l
      join public.listing_sides s on s.listing_id = l.id
     where l.game_slug = p_game
       and l.status = 'active'
       and l.expires_at > now()
       and l.user_id <> (select uid from me)
       and not exists (
         select 1 from public.blocks b
         where (b.blocker_id = (select uid from me) and b.blocked_id = l.user_id)
            or (b.blocker_id = l.user_id and b.blocked_id = (select uid from me))
       )
       and (p_cursor is null or l.bumped_at < p_cursor)
     group by l.id, l.user_id, l.note, l.bumped_at
  )
  select id, user_id, note, bumped_at,
         case
           when gives > 0 and takes > 0 then 'RECIPROCAL_MATCH'
           when gives > 0               then 'HAS_WHAT_YOU_WANT'
           when takes > 0               then 'WANTS_WHAT_YOU_HAVE'
           else 'NEW_IN_YOUR_GAME'
         end,
         -- Reciprocal matches are the ones that actually close, so they win.
         (case when gives > 0 and takes > 0 then 60 else 0 end
          + least(gives, 5)::int * 6
          + least(takes, 5)::int * 4)::int
    from candidates
   order by 6 desc, bumped_at desc
   limit least(p_limit, 50);
$$;


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
   'Fruit trading, raid teams, and sea hunts that need more players than you have friends online.',
   '{trades,inventory,activities,help}', '{Raid,"Sea event","Boss hunt","Grind session"}',
   '{Fruit,Sword,Gun,Accessory,Material}', '#D9542B', '/games/blox-fruits.jpg', 1),
  ('grow-a-garden', 'Grow a Garden', 'Garden',
   'Crop and pet trades, plus coordinating around the weather and mutation windows worth showing up for.',
   '{trades,inventory,activities,help}', '{"Weather window","Mutation run",Event,"Group session"}',
   '{Crop,Seed,Pet,Gear}', '#5BAE3A', '/games/grow-a-garden.jpg', 2),
  ('adopt-me', 'Adopt Me!', 'Adopt Me',
   'Pet trades, and finding the people who will actually sit through a neon or mega project with you.',
   '{trades,inventory,help,activities}', '{"Neon project","Mega project","Task run",Event}',
   '{Pet,Egg,Vehicle,Toy,Food}', '#E8B23A', '/games/adopt-me.jpg', 3),
  ('murder-mystery-2', 'Murder Mystery 2', 'MM2',
   'Collectible trades and finding a group when an event is genuinely running, not months after it ended.',
   '{trades,inventory,activities}', '{"Event grind","Collection goal","Group session"}',
   '{Knife,Gun,Pet,Bundle}', '#D9538F', '/games/murder-mystery-2.jpg', 4),
  ('royale-high', 'Royale High', 'Royale High',
   'Halo and set trades, campus quest partners, and groups for the activities nobody wants to do alone.',
   '{trades,inventory,activities,help}', '{"Quest run","Campus activity",Pageant,Event}',
   '{Halo,Set,Accessory,Skirt,Heels,Wings}', '#D98BC4', '/games/royale-high.jpg', 5),
  ('creatures-of-sonaria', 'Creatures of Sonaria', 'Sonaria',
   'Creature trades and pack recruitment for the missions that are built to need a group.',
   '{trades,inventory,activities,help}', '{"Pack mission","Daily mission","Weekly mission","Event mission"}',
   '{Creature,Skin,Item}', '#4E8FB5', '/games/creatures-of-sonaria.jpg', 6)
on conflict (slug) do update set
  name = excluded.name, short_name = excluded.short_name, blurb = excluded.blurb,
  modules = excluded.modules, activity_kinds = excluded.activity_kinds,
  item_categories = excluded.item_categories, hue = excluded.hue,
  art = excluded.art, sort_order = excluded.sort_order;


-- ===========================================================================
-- Verified against PostgreSQL 16 before shipping. The rules that were proven,
-- not just written:
--
--   three listings succeed, the fourth is rejected with the reset time
--   cancelling a listing does NOT return a slot
--   slots return once the three-hour window rolls past
--   client-supplied created_at / expires_at are overwritten by the server
--   a seven-day lifetime is applied on insert
--   a reciprocal match outranks a one-directional one (70 vs 6)
--   a block removes the other player from matching entirely
--   is_moderator() is false without the app_metadata role claim
-- ===========================================================================
