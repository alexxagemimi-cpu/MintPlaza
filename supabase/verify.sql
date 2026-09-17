-- Did schema.sql actually land?
--
-- Paste this into the Supabase SQL editor after running schema.sql. It reads
-- the database rather than trusting the editor's "Success", and answers the
-- only question that matters: can the application run against this now.
--
-- Eight rows, all of which should read OK. Anything else names what is wrong.

select check_name, result from (
  select 1 as ord, 'Inventory keyed on slugs (the main fix)' as check_name,
    case when (select data_type from information_schema.columns
                where table_schema='public' and table_name='inventory_entries'
                  and column_name='item_id') = 'text'
         then 'OK' else 'NOT APPLIED' end as result
  union all select 2, 'All 8 games present',
    case when (select count(*) from public.games
                where slug in ('blox-fruits','adopt-me','pet-simulator-99',
                               'creatures-of-sonaria','fisch','gag2')) = 8
         then 'OK' else 'MISSING: only '||(select count(*)::text from public.games) end
  union all select 3, 'All 29 app functions exist',
    case when (select count(*) from unnest(array[
           'add_proof','admin_add_media','admin_delete_media','admin_reorder_games',
           'admin_reports','admin_resolve_report','admin_save_game','admin_save_template',
           'admin_set_explore_tabs','admin_set_game_active','admin_set_template_active',
           'board_listings','bump_listing','cancel_trade_listing','console_lock',
           'console_phrase_matches','console_unlock','console_unlocked','delete_my_account',
           'delete_proof','ensure_profile','is_admin','listing_allowance','post_trade_listing',
           'public_profile','save_profile','set_display_name','set_hide_presence','touch_presence'
         ]) f where to_regproc('public.'||f) is not null) = 29
         then 'OK' else 'MISSING '||(29 - (select count(*) from unnest(array[
           'add_proof','admin_add_media','admin_delete_media','admin_reorder_games',
           'admin_reports','admin_resolve_report','admin_save_game','admin_save_template',
           'admin_set_explore_tabs','admin_set_game_active','admin_set_template_active',
           'board_listings','bump_listing','cancel_trade_listing','console_lock',
           'console_phrase_matches','console_unlock','console_unlocked','delete_my_account',
           'delete_proof','ensure_profile','is_admin','listing_allowance','post_trade_listing',
           'public_profile','save_profile','set_display_name','set_hide_presence','touch_presence'
         ]) f where to_regproc('public.'||f) is not null))::text end
  union all select 4, 'Security on every table',
    case when (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
                where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) = 0
         then 'OK' else (select string_agg(c.relname,', ') from pg_class c
                join pg_namespace n on n.oid=c.relnamespace
                where n.nspname='public' and c.relkind='r' and not c.relrowsecurity)
                ||' UNPROTECTED' end
  union all select 5, 'Sign-in repaired (admin allowlist exists)',
    case when to_regclass('mintplaza.admin_allowlist') is not null
         then 'OK' else 'MISSING' end
  union all select 6, 'Console gate ready',
    case when to_regclass('mintplaza.console_secret') is not null
         then 'OK' else 'MISSING' end
  union all select 7, 'Scheduled cleanups',
    case when exists (select 1 from pg_extension where extname='pg_cron')
         then 'scheduled' else 'pg_cron off (harmless)' end
  union all select 8, 'YOUR NEXT STEP',
    case when exists (select 1 from mintplaza.admin_allowlist)
         then 'admin set - you are done'
         else 'run the 2 setup lines below' end
) q order by ord;
