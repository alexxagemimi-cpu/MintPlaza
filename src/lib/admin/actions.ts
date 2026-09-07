"use server";

import { revalidatePath } from "next/cache";
import { serverSupabase } from "@/lib/supabase/server";
import { isAdmin } from "./auth";
import type { Rarity } from "@/lib/items";

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
  valuePhysical?: number | null;
  valuePermanent?: number | null;
  demand?: number | null;
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
  // A blank number means "not known", which is not the same as zero — a zero
  // would make the trade calculator price the item at nothing.
  for (const k of ["beli", "robux", "valuePhysical", "valuePermanent", "demand"] as const) {
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
  if (d.demand != null && (d.demand < 1 || d.demand > 6))
    return "Demand runs from Very low up to Extreme.";
  for (const [k, label] of [
    ["beli", "Beli price"], ["robux", "Robux price"],
    ["valuePhysical", "Physical value"], ["valuePermanent", "Permanent value"],
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

/**
 * Put an item's money fields back to an earlier recorded version.
 *
 * The point of keeping history is being able to undo, and a mistyped value that
 * quietly changes every W/L verdict on the site is exactly the mistake worth
 * being able to take back in one tap.
 */
export async function revertValue(itemId: string, historyId: number): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not found." };
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const { data: past, error: readError } = await supabase
    .from("item_value_history")
    .select("value_physical, value_permanent, demand, beli, robux")
    .eq("id", historyId).eq("item_id", itemId).maybeSingle();
  if (readError || !past) return { ok: false, error: "That version is no longer on record." };

  const { data: row } = await supabase
    .from("game_items").select("attributes").eq("id", itemId).maybeSingle();
  const attrs = { ...((row?.attributes ?? {}) as Record<string, unknown>) };

  for (const [key, value] of [
    ["valuePhysical", past.value_physical], ["valuePermanent", past.value_permanent],
    ["demand", past.demand], ["beli", past.beli], ["robux", past.robux],
  ] as const) {
    if (value == null) delete attrs[key];
    else attrs[key] = Number(value);
  }

  const { error } = await supabase.from("game_items").update({ attributes: attrs }).eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app", "layout");
  return { ok: true, id: itemId };
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
