"use server";

import { revalidatePath } from "next/cache";
import { serverSupabase } from "@/lib/supabase/server";
import { isAdmin } from "./auth";
import type { Rarity } from "@/lib/items";
import { LEVEL_UP_DAYS } from "@/lib/level-up";

/**
 * Everything the admin panel can change.
 *
 * Every action re-checks `isAdmin()` before touching anything. That check is
 * belt to the database's braces: row-level security would refuse the write
 * anyway, but failing here gives a clean message instead of a policy error, and
 * means a bug that widened one of these functions still could not write.
 *
 * Nothing is deleted. Items go inactive, which keeps every inventory row and
 * listing that points at them intact — a hard delete would silently empty
 * somebody's lists. The audit trigger records who did what either way.
 */

export interface ItemDraft {
  id?: string;
  gameSlug: string;
  name: string;
  category: string;
  rarity?: Rarity | "";
  type?: string;
  aliases?: string;
  formerly?: string;
  chromatic?: boolean;
  tradeable?: boolean;
  parentSlug?: string;
  note?: string;
  art?: string;
  beli?: number | null;
  robux?: number | null;
}

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const list = (s?: string) =>
  (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

/** A stable catalogue slug, so ids stay readable and survive a rename. */
const slugify = (gameSlug: string, name: string) => {
  const prefix = gameSlug.split("-").map((w) => w[0]).join("");
  return `${prefix}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
};

function attributesFrom(d: ItemDraft, existingSlug?: string) {
  const attrs: Record<string, unknown> = {
    slug: existingSlug ?? slugify(d.gameSlug, d.name),
  };
  if (d.rarity) attrs.rarity = d.rarity;
  if (d.type) attrs.type = d.type;
  if (list(d.formerly).length) attrs.formerly = list(d.formerly);
  if (list(d.aliases).length) attrs.aliases = list(d.aliases);
  if (d.chromatic) attrs.chromatic = true;
  if (d.tradeable === false) attrs.tradeable = false;
  if (d.parentSlug) attrs.parentSlug = d.parentSlug;
  if (d.note) attrs.note = d.note;
  if (d.art) attrs.art = d.art;
  // Beli and Robux are the game's OWN shop prices — published by the
  // developer, and they do not move. They are the only money left on an item.
  //
  // valuePhysical, valuePermanent and demand are gone: MintPlaza keeps no
  // values (see referrals.ts). They are not listed here, and because an update
  // REPLACES the attributes object rather than merging into it, saving any item
  // in the panel also strips whatever stale numbers that row was still
  // carrying. The schema clears the rest in one pass on the next apply.
  //
  // A blank number still means "not known", which is not the same as zero.
  for (const k of ["beli", "robux"] as const) {
    const v = d[k];
    if (typeof v === "number" && Number.isFinite(v)) attrs[k] = v;
  }
  return attrs;
}

function validate(d: ItemDraft): string | null {
  if (!d.name?.trim()) return "The item needs a name.";
  if (d.name.length > 80) return "That name is too long to fit a tile.";
  if (!d.gameSlug) return "The item needs a game.";
  if (!d.category?.trim()) return "The item needs a category, such as Fruit or Gamepass.";
  for (const [k, label] of [
    ["beli", "Beli price"], ["robux", "Robux price"],
  ] as const) {
    const v = d[k];
    if (v != null && (v < 0 || !Number.isFinite(v))) return `${label} cannot be negative.`;
  }
  return null;
}

export async function saveItem(draft: ItemDraft): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const problem = validate(draft);
  if (problem) return { ok: false, error: problem };

  if (draft.id) {
    // Keep the existing slug: it is what listings, inventory rows and skin
    // parents point at, so a rename must not move it.
    const { data: existing } = await supabase
      .from("game_items").select("attributes").eq("id", draft.id).maybeSingle();
    const slug = (existing?.attributes as Record<string, unknown> | null)?.slug as string | undefined;

    const { error } = await supabase
      .from("game_items")
      .update({
        name: draft.name.trim(),
        category: draft.category.trim(),
        attributes: attributesFrom(draft, slug),
        verified_at: new Date().toISOString(),
      })
      .eq("id", draft.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/app", "layout");
    return { ok: true, id: draft.id };
  }

  const { data, error } = await supabase
    .from("game_items")
    .insert({
      game_slug: draft.gameSlug,
      name: draft.name.trim(),
      category: draft.category.trim(),
      attributes: attributesFrom(draft),
      is_active: true,
      verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      error: error.code === "23505"
        ? `${draft.name} already exists in this game.`
        : error.message,
    };
  }
  revalidatePath("/app", "layout");
  return { ok: true, id: data.id };
}

/**
 * Retire an item. Never a delete: inventory rows and listings reference these,
 * and removing the row would empty somebody's lists without telling them.
 */
export async function setItemActive(id: string, active: boolean): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const { error } = await supabase.from("game_items").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app", "layout");
  return { ok: true, id };
}

/** Whatever the game itself says about the site's presentation. */
export async function saveGame(
  slug: string,
  patch: { name?: string; blurb?: string; hue?: string; art?: string },
): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const { error } = await supabase.from("games").update(patch).eq("slug", slug);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app", "layout");
  return { ok: true, id: slug };
}

/* ------------------------------------------------------------------ */
/*  Player reports                                                     */
/* ------------------------------------------------------------------ */

export interface AdminReport {
  id: string;
  created_at: string;
  status: "open" | "actioned" | "dismissed";
  subject_type: string;
  subject_id: string;
  subject_label: string | null;
  reason: string;
  detail: string | null;
  evidence_url: string | null;
  reporter_username: string | null;
  reporter_roblox_id: string | null;
  admin_note: string | null;
}

/**
 * The queue.
 *
 * A report button that goes nowhere is worse than none — it teaches people the
 * site does not act, and they stop telling you things. This is the other half
 * of that button.
 *
 * Reading is gated inside the database function rather than here, because a
 * report names both sides and the person reported must never be able to learn
 * that they were.
 */
export async function listReports(
  status: "open" | "actioned" | "dismissed" | "all" = "open",
): Promise<AdminReport[]> {
  if (!(await isAdmin())) return [];
  const supabase = await serverSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("admin_reports", { p_status: status });
  if (error || !Array.isArray(data)) return [];
  return data as AdminReport[];
}

export async function resolveReport(
  id: string,
  status: "open" | "actioned" | "dismissed",
  note?: string,
): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const { error } = await supabase.rpc("admin_resolve_report", {
    p_id: id, p_status: status, p_note: note?.slice(0, 500) ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app", "layout");
  return { ok: true, id };
}

/* ------------------------------------------------------------------ */
/*  What a game calls its three boards                                 */
/* ------------------------------------------------------------------ */

export interface ExploreTabDraft {
  id: string;
  label: string;
  blurb?: string;
  kind: "trades" | "services" | "community";
}

/**
 * Rename a game's tabs.
 *
 * The `kind` is the contract and never moves: there are three engines behind
 * these tabs — a trade board with a calculator, a services board, a crew board
 * — and no fourth. What is editable is what each is *called*. Blox Fruits says
 * "Raids & Services"; a fishing game saying the same would be advertising
 * somebody else's furniture.
 *
 * The shape is validated by the database, by a CHECK on the column rather than
 * only inside the setter, so a bad edit cannot arrive by some other route and
 * leave a game rendering three untitled tabs.
 */
export async function saveExploreTabs(
  slug: string, tabs: ExploreTabDraft[],
): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const clean = tabs
    .map((t) => ({
      id: t.id.trim(),
      label: t.label.trim().slice(0, 40),
      blurb: t.blurb?.trim().slice(0, 200) ?? "",
      kind: t.kind,
    }))
    .filter((t) => t.id && t.label);

  if (clean.length === 0) return { ok: false, error: "Every tab needs a name." };

  const { error } = await supabase.rpc("admin_set_explore_tabs", {
    p_slug: slug, p_tabs: clean,
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };
  revalidatePath("/app", "layout");
  return { ok: true, id: slug };
}

/* ------------------------------------------------------------------ */
/*  Studio: templates, games, pictures                                 */
/* ------------------------------------------------------------------ */

export interface TemplateDraft {
  id: string;
  gameSlug: string;
  name: string;
  kind: string;
  section: "services" | "recruit";
  art?: string | null;
  needs?: string | null;
  players?: number | null;
  gives?: string | null;
  openEnded?: boolean;
  aliases?: string[];
  refs?: { id: string; label: string; hue?: string; art?: string }[];
  verified?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  /**
   * Does finishing this pay everybody who took part?
   *
   * Three states on purpose. true means checked and yes. false means checked
   * and no. undefined means nobody has looked — and undefined behaves exactly
   * like false, because a recruitment template nobody has checked is one that
   * might be gathering people to lose a race.
   */
  everyoneRewarded?: boolean;
  /** In the catalogue, off the board. */
  isDraft?: boolean;
  group?: string | null;
}

const KINDS = [
  "Raid", "Trial", "Puzzle", "Boss", "Unlock",
  "Grind", "Island", "Crew", "Event", "Hunt",
];

/**
 * Save a list template.
 *
 * The two rules worth checking before the round trip, because both produce a
 * message a person can act on rather than a constraint violation: a services
 * template may not need more than three players, and a recruitment one may not
 * need fewer. That line is what keeps the two boards from becoming one board,
 * and the database enforces it as well — this is the polite version.
 */
export async function saveTemplate(draft: TemplateDraft): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const id = draft.id.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,60}$/.test(id)) {
    return { ok: false, error: "The id must be lowercase letters, numbers and dashes." };
  }
  if (!draft.name.trim()) return { ok: false, error: "The template needs a name." };
  if (!KINDS.includes(draft.kind)) return { ok: false, error: "Pick a kind from the list." };

  const players = draft.players ?? null;
  if (players !== null) {
    if (draft.section === "services" && players > 3) {
      return {
        ok: false,
        error: "Raids & Services is for one or two helpers. Anything needing more belongs in Help & Recruitment.",
      };
    }
    if (draft.section === "recruit" && players < 3) {
      return {
        ok: false,
        error: "Help & Recruitment is for three or more. Anything smaller belongs in Raids & Services.",
      };
    }
  }

  const refs = (draft.refs ?? [])
    .map((r) => ({
      id: r.id.trim(),
      label: r.label.trim().slice(0, 40),
      hue: r.hue?.trim() || undefined,
      art: r.art?.trim() || undefined,
    }))
    .filter((r) => r.id && r.label)
    .slice(0, 12);

  const { error } = await supabase.rpc("admin_save_template", {
    p: {
      id,
      game_slug: draft.gameSlug,
      name: draft.name.trim().slice(0, 80),
      kind: draft.kind,
      section: draft.section,
      art: draft.art?.trim() || "",
      needs: draft.needs?.trim().slice(0, 600) || "",
      players: players === null ? "" : String(players),
      gives: draft.gives?.trim().slice(0, 300) || "",
      open_ended: draft.openEnded ?? false,
      aliases: (draft.aliases ?? []).map((a) => a.trim()).filter(Boolean).slice(0, 20),
      refs,
      verified: draft.verified ?? true,
      is_active: draft.isActive ?? true,
      sort_order: draft.sortOrder ?? 0,
      // Sent as null rather than false when unanswered, so the database can
      // keep "checked, and no" apart from "nobody has looked yet".
      everyone_rewarded:
        draft.everyoneRewarded === undefined ? null : draft.everyoneRewarded,
      is_draft: draft.isDraft ?? false,
      group_label: draft.group?.trim().slice(0, 40) || "",
    },
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };
  revalidatePath("/app", "layout");
  return { ok: true, id };
}

/**
 * Retire a template, or bring it back.
 *
 * Never a delete. Live listings point at these ids, and removing one would turn
 * somebody's post into a card about nothing — which is exactly the bug this
 * project already hit once and fixed.
 */
export async function setTemplateActive(id: string, active: boolean): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };
  const { error } = await supabase.rpc("admin_set_template_active", {
    p_id: id, p_active: active,
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };
  revalidatePath("/app", "layout");
  return { ok: true, id };
}

export interface GameDraft {
  slug: string;
  name: string;
  shortName?: string;
  blurb?: string;
  hue?: string;
  art?: string;
  modules?: string[];
  exploreTabs?: ExploreTabDraft[];
  itemCategories?: string[];
  isActive?: boolean;
}

/** Add a game, or change everything about one. */
export async function saveGameFull(draft: GameDraft): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const slug = draft.slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) {
    return { ok: false, error: "The web address part must be lowercase letters, numbers and dashes." };
  }
  if (!draft.name.trim()) return { ok: false, error: "The game needs a name." };

  const { error } = await supabase.rpc("admin_save_game", {
    p: {
      slug,
      name: draft.name.trim(),
      short_name: draft.shortName?.trim() || draft.name.trim(),
      blurb: draft.blurb?.trim() ?? "",
      hue: draft.hue?.trim() ?? "",
      art: draft.art?.trim() ?? "",
      modules: draft.modules ?? [],
      explore_tabs: (draft.exploreTabs ?? []).map((t) => ({
        id: t.id.trim(), label: t.label.trim().slice(0, 40),
        blurb: t.blurb?.trim().slice(0, 200) ?? "", kind: t.kind,
      })),
      item_categories: draft.itemCategories ?? [],
      is_active: draft.isActive ?? true,
    },
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };
  revalidatePath("/app", "layout");
  return { ok: true, id: slug };
}

export async function setGameActive(slug: string, active: boolean): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };
  const { error } = await supabase.rpc("admin_set_game_active", {
    p_slug: slug, p_active: active,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app", "layout");
  return { ok: true, id: slug };
}

export async function reorderGames(slugs: string[]): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };
  const { error } = await supabase.rpc("admin_reorder_games", { p_slugs: slugs });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Put a picture on the shared shelf so every picker can offer it. */
export async function addMedia(
  url: string, label: string, kind: string, gameSlug?: string,
): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };
  if (!/^(\/|https?:\/\/)/.test(url.trim())) {
    return { ok: false, error: "That does not look like a picture address." };
  }
  const { error } = await supabase.rpc("admin_add_media", {
    p_url: url.trim(), p_label: label.trim().slice(0, 80) || "Untitled",
    p_kind: kind, p_game: gameSlug ?? "",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function deleteMedia(id: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };
  const { error } = await supabase.rpc("admin_delete_media", { p_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app", "layout");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/*  Support messages                                                   */
/* ------------------------------------------------------------------ */

export interface SupportMessage {
  id: string;
  created_at: string;
  status: "open" | "answered" | "closed";
  body: string;
  context: string | null;
  admin_note: string | null;
  resolved_at: string | null;
  sender_username: string | null;
  sender_roblox_id: string | null;
}

/**
 * The "tell us your problem" queue.
 *
 * Separate from reports on purpose. A report is about a person and needs a
 * moderation decision; this is about the site and usually needs a fix or a
 * sentence back. Folding them into one list would bury the moderation queue
 * under "how do I trade", which is how a report button stops being answered.
 */
export async function listSupport(
  status: "open" | "answered" | "closed" | "all" = "open",
): Promise<SupportMessage[]> {
  if (!(await isAdmin())) return [];
  const supabase = await serverSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("admin_support_messages", { p_status: status });
  if (error || !Array.isArray(data)) return [];
  return data as SupportMessage[];
}

export async function resolveSupport(
  id: string,
  status: "open" | "answered" | "closed",
  note?: string,
): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const { error } = await supabase.rpc("admin_resolve_support", {
    p_id: id, p_status: status, p_note: note?.slice(0, 2000) ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app", "layout");
  return { ok: true, id };
}

/* ------------------------------------------------------------------ */
/* Level Up                                                            */
/* ------------------------------------------------------------------ */

export interface LevelUpRow {
  username: string;
  roblox_user_id: string;
  expires_at: string;
  active: boolean;
  source: "purchase" | "gift" | "comp" | "refunded";
  country: string | null;
  payment_ref: string | null;
  created_at: string;
}

/**
 * Everyone who has ever had Level Up.
 *
 * Including the lapsed and the refunded, because this is the owner's record of
 * what was sold rather than a list of current subscribers. "Who paid me in
 * March" is the question this gets asked, and a list that quietly drops
 * everybody whose 60 days ran out cannot answer it.
 */
export async function listLevelUps(): Promise<LevelUpRow[]> {
  if (!(await isAdmin())) return [];
  const supabase = await serverSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("admin_level_ups");
  if (error || !Array.isArray(data)) return [];
  return data as LevelUpRow[];
}

/**
 * Grant it by hand.
 *
 * This is the whole payment system until a processor is connected, and it is
 * not a stopgap so much as the honest shape of the thing: money arrives
 * somewhere, a person confirms it arrived, and the entitlement is written. A
 * webhook would do the same three steps with the person replaced by a
 * signature check.
 *
 * The username is a Roblox username, and it has to belong to somebody who has
 * signed in at least once — there is no profile row to attach an entitlement to
 * before that. The database says so in those words rather than failing with a
 * null.
 */
export async function grantLevelUp(input: {
  username: string;
  days?: number;
  country?: string;
  source?: "purchase" | "gift" | "comp";
  paymentRef?: string;
}): Promise<ActionResult & { expiresAt?: string; alreadyApplied?: boolean }> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const username = input.username.trim();
  if (!username) return { ok: false, error: "Which player?" };

  const { data, error } = await supabase.rpc("admin_grant_level_up", {
    p_roblox_username: username,
    p_days: input.days ?? LEVEL_UP_DAYS,
    p_country: input.country?.trim() || null,
    p_source: input.source ?? "purchase",
    p_payment_ref: input.paymentRef?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  const row = (data ?? {}) as { expires_at?: string; already_applied?: boolean };
  revalidatePath("/app", "layout");
  return {
    ok: true,
    expiresAt: row.expires_at,
    alreadyApplied: row.already_applied === true,
  };
}

/**
 * End one early — a refund, a chargeback, or somebody who bought it and then
 * got themselves suspended.
 *
 * Never a delete. The row is the record that money changed hands, and deleting
 * it loses the only trace of a transaction the owner may later have to explain.
 */
export async function revokeLevelUp(username: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const { error } = await supabase.rpc("admin_revoke_level_up", {
    p_roblox_username: username.trim(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app", "layout");
  return { ok: true };
}

/* ---------------------------------------------------------------------------
 * Announcements
 * ------------------------------------------------------------------------- */

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  media_url: string | null;
  media_kind: "image" | "video" | null;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
  dismissals: number;
  live: boolean;
}

/** Everything ever posted, including expired and pulled. Newest first. */
export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  if (!(await isAdmin())) return [];
  const supabase = await serverSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("admin_announcements");
  if (error || !data) return [];
  return data as AnnouncementRow[];
}

/**
 * Post a new announcement, or edit one that is already up.
 *
 * Days rather than a date, because that is the question being answered — "how
 * long should this stay up" — and editing restarts the clock, which is what
 * "make it run another week" means when you are looking at it on day three.
 *
 * The URL is checked here as well as by the database. Two checks on the one
 * value that becomes the `src` of a tag every visitor loads is not redundancy
 * worth trimming.
 */
export async function saveAnnouncement(input: {
  id?: string;
  title: string;
  body: string;
  mediaUrl?: string;
  mediaKind?: "image" | "video" | "";
  days: number;
}): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) return { ok: false, error: "Give it a title." };
  if (title.length > 120) return { ok: false, error: "Title is over 120 characters." };
  if (!body) return { ok: false, error: "Say something in the description." };
  if (body.length > 4000) return { ok: false, error: "Description is over 4000 characters." };

  const url = (input.mediaUrl ?? "").trim();
  const kind = input.mediaKind || "";
  if (url && !/^https:\/\/\S+$/.test(url)) {
    return { ok: false, error: "The attachment link must start with https:// and have no spaces." };
  }
  if (url && !kind) return { ok: false, error: "Say whether the attachment is a photo or a video." };
  if (kind && !url) return { ok: false, error: "Paste the link to the photo or video, or clear the type." };

  const days = Math.round(Number(input.days));
  if (!Number.isFinite(days) || days < 1) return { ok: false, error: "How many days? One or more." };
  if (days > 365) return { ok: false, error: "A year is the longest an announcement can run." };

  const { data, error } = await supabase.rpc("admin_save_announcement", {
    p_id: input.id ?? null,
    p_title: title,
    p_body: body,
    p_media_url: url || null,
    p_media_kind: url ? kind : null,
    p_days: days,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true, id: data as string };
}

/** Pull one down early, or put it back up. Never deletes: a deleted
 *  announcement takes every "don't show again" with it, so everybody who had
 *  already put it away would be shown it again by a later one reusing the id. */
export async function setAnnouncementActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const { error } = await supabase.rpc("admin_set_announcement_active", {
    p_id: id, p_active: active,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true, id };
}
