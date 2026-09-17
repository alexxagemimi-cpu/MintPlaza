"use client";

import { useMemo, useState, useTransition } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import {
  saveItem, setItemActive, saveGame, saveExploreTabs,
  type ItemDraft, type AdminReport, type ExploreTabDraft, type SupportMessage } from "@/lib/admin/actions";
import { ReportsPanel } from "./ReportsPanel";
import { SupportPanel } from "./SupportPanel";
import { LevelUpPanel } from "./LevelUpPanel";
import { Studio } from "./Studio";
import type { StudioTemplate, MediaRow } from "@/lib/data/templates";
import type { LevelUpRow } from "@/lib/admin/actions";
import { lockConsole } from "@/lib/admin/gate";
import { MoneyInput } from "./MoneyInput";
import type { Rarity } from "@/lib/items";

/**
 * The admin panel.
 *
 * One person uses this, on a tablet, to keep six games' catalogues current. So
 * it is built for the two jobs that actually recur — changing a value that
 * moved overnight, and adding an item the game just shipped — and everything
 * else stays out of the way until asked for.
 *
 * The parts that matter:
 *
 *   - Nothing is deleted. Retiring an item hides it everywhere but keeps every
 *     listing and inventory row that points at it intact.
 *   - Every money field distinguishes blank from zero. Blank means nobody has
 *     confirmed the price; zero would mean the game gives it away.
 *
 * What is NOT here any more: trade values, demand, and the dated history that
 * let an admin roll a mistyped value back. MintPlaza keeps no values — see
 * src/lib/referrals.ts — so the only money on an item is the game's own shop
 * price, which the developer publishes and which does not move. A panel that
 * still offered a value field would be asking somebody to maintain a number
 * nothing reads.
 */

const RARITIES: Rarity[] = [
  "Common", "Uncommon", "Rare", "Ultra-Rare", "Legendary", "Mythical", "Premium",
];

export interface ConsoleGame {
  slug: string; name: string; short_name: string;
  blurb: string | null; hue: string | null; art: string | null; sort_order: number;
  /**
   * What this game calls each of the three boards.
   *
   * The `kind` picks the engine behind a tab and is not editable — there are
   * three engines and no fourth. The label is content: Blox Fruits says "Raids
   * & Services", and a fishing game forced to advertise raids reads as somebody
   * else's furniture.
   */
  explore_tabs?: { id: string; label: string; blurb?: string; kind: string }[] | null;
}

export interface ConsoleItem {
  id: string; game_slug: string; name: string; category: string | null;
  attributes: Record<string, unknown>; is_active: boolean;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

function draftFrom(item: ConsoleItem): ItemDraft {
  const a = item.attributes ?? {};
  return {
    id: item.id,
    gameSlug: item.game_slug,
    name: item.name,
    category: item.category ?? "",
    rarity: (str(a.rarity) || "") as Rarity | "",
    type: str(a.type),
    aliases: arr(a.aliases).join(", "),
    formerly: arr(a.formerly).join(", "),
    chromatic: a.chromatic === true,
    tradeable: a.tradeable !== false,
    parentSlug: str(a.parentSlug),
    note: str(a.note),
    art: str(a.art),
    beli: num(a.beli),
    robux: num(a.robux),
  };
}

function blankDraft(gameSlug: string, category: string): ItemDraft {
  return {
    gameSlug, name: "", category, rarity: "", type: "",
    aliases: "", formerly: "", chromatic: false, tradeable: true,
    parentSlug: "", note: "", art: "",
    beli: null, robux: null,
  };
}

/* ------------------------------------------------------------------ */

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[0.5625rem] font-medium uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[0.6875rem] text-ink-faint">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[0.9375rem] text-ink outline-none focus:border-mint";

function ArtUpload({
  value, onChange, itemName,
}: { value: string; onChange: (url: string) => void; itemName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    const supabase = browserSupabase();
    if (!supabase) { setError("No database configured."); return; }
    if (file.size > 2_000_000) {
      setError("That image is over 2MB. Pick a smaller one — big images make every listing slow to load.");
      return;
    }
    setBusy(true);
    const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
    const path = `${itemName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("item-art").upload(path, file, { cacheControl: "31536000", upsert: false });
    if (upErr) { setError(upErr.message); setBusy(false); return; }
    const { data } = supabase.storage.from("item-art").getPublicUrl(path);
    onChange(data.publicUrl);
    setBusy(false);
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[12px] border border-line bg-fill">
          {value
            ? /* eslint-disable-next-line @next/next/no-img-element */
              <img src={value} alt="" className="h-full w-full object-contain" />
            : <span className="font-mono text-[0.5625rem] text-ink-faint">NONE</span>}
        </span>
        <div className="min-w-0 flex-1">
          <label className="pill pill-ghost cursor-pointer py-2 text-[0.8125rem]">
            {busy ? "Uploading…" : value ? "Replace image" : "Upload image"}
            <input
              type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              className="sr-only" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
            />
          </label>
          {value && (
            <button
              type="button" onClick={() => onChange("")}
              className="ml-2 text-[0.8125rem] font-semibold text-bad underline"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-[0.8125rem] text-bad">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ItemEditor({
  draft, onChange, onSave, onCancel, onRetire, saving, error, isNew, categories, parents,
}: {
  draft: ItemDraft;
  onChange: (d: ItemDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  onRetire?: () => void;
  saving: boolean;
  error: string | null;
  isNew: boolean;
  categories: string[];
  parents: { slug: string; name: string }[];
}) {
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) =>
    onChange({ ...draft, [k]: v });

  return (
    <div className="border-t border-line-soft px-3 pb-4 pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input className={inputClass} value={draft.name}
            onChange={(e) => set("name", e.target.value)} autoFocus={isNew} />
        </Field>
        <Field label="What kind of thing is it?">
          <select className={inputClass} value={draft.category}
            onChange={(e) => set("category", e.target.value)}>
            {!categories.includes(draft.category) && draft.category !== "" && (
              <option value={draft.category}>{draft.category}</option>
            )}
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__new">Something new…</option>
          </select>
          {draft.category === "__new" && (
            <input autoFocus className={`${inputClass} mt-2`} placeholder="Name the kind, e.g. Sword"
              onChange={(e) => set("category", e.target.value)} />
          )}
        </Field>
        <Field label="How rare is it?">
          <select className={inputClass} value={draft.rarity ?? ""}
            onChange={(e) => set("rarity", e.target.value as Rarity | "")}>
            <option value="">Not set</option>
            {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Fruit type" hint="Natural, Elemental or Beast. Leave empty if it is not a fruit.">
          <input className={inputClass} value={draft.type ?? ""}
            onChange={(e) => set("type", e.target.value)} />
        </Field>
      </div>

      <div className="mt-4 rounded-[12px] border border-line-soft bg-fill p-3">
        <p className="mb-3 text-[0.8125rem] leading-relaxed text-ink-mute">
          These are two different things. <b className="text-ink">What it costs</b> is
          the game&rsquo;s own price. <b className="text-ink">What it trades for</b> is
          what players will actually give you — Portal costs 1.9M Beli but trades
          for about 10M. The win/loss checker on every listing uses what it trades
          for, never the cost. You can type <b className="text-ink">10M</b> or{" "}
          <b className="text-ink">1.9B</b> instead of counting zeros. Leave a box empty
          if you don&rsquo;t know the number — empty is fine, but a 0 tells the site
          the item is worth nothing.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Costs in the game (Beli)">
            <MoneyInput value={draft.beli ?? null} onChange={(v) => set("beli", v)}
              placeholder="e.g. 1.9M" />
          </Field>
          <Field label="Costs in the game (Robux)">
            <MoneyInput value={draft.robux ?? null} onChange={(v) => set("robux", v)}
              placeholder="e.g. 2000" />
          </Field>
          {/* "Trades for", "Trades for (permanent)" and "How much people want
              it" used to sit here. They are gone on purpose: MintPlaza keeps no
              values, and a field that saves a number nothing reads back is
              worse than no field — somebody fills in forty of them and wonders
              why the site never changes. Values live on the partner sites now;
              see referrals.ts. The two boxes above are the game's OWN shop
              prices, which are facts published by the developer and do not
              move. */}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Other names people call it" hint="Separate them with commas. Helps people find it in search.">
          <input className={inputClass} value={draft.aliases ?? ""}
            onChange={(e) => set("aliases", e.target.value)} />
        </Field>
        <Field label="What it used to be called" hint="Shown on the item as WAS X. Leave empty if it was never renamed.">
          <input className={inputClass} value={draft.formerly ?? ""}
            onChange={(e) => set("formerly", e.target.value)} />
        </Field>
        <Field label="Is this a skin of something?"
          hint="Pick the fruit it recolours. Leave as None for anything else.">
          <select className={inputClass} value={draft.parentSlug ?? ""}
            onChange={(e) => set("parentSlug", e.target.value)}>
            <option value="">None</option>
            {parents.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Anything to say about it">
          <input className={inputClass} value={draft.note ?? ""}
            onChange={(e) => set("note", e.target.value)} />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[0.875rem] font-semibold text-ink">
          <input type="checkbox" checked={draft.chromatic ?? false}
            onChange={(e) => set("chromatic", e.target.checked)} />
          CHROMATIC
        </label>
        <label className="flex items-center gap-2 text-[0.875rem] font-semibold text-ink">
          <input type="checkbox" checked={draft.tradeable ?? true}
            onChange={(e) => set("tradeable", e.target.checked)} />
          Can be traded
        </label>
      </div>
      <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-faint">
        Turn off <b>Can be traded</b> for something people can own but cannot swap —
        a fruit&rsquo;s default look, for instance. It still shows when browsing, but nobody
        can put it in a trade.
      </p>

      <div className="mt-4">
        <Field label="Picture">
          <ArtUpload value={draft.art ?? ""} onChange={(url) => set("art", url)}
            itemName={draft.name || "item"} />
        </Field>
      </div>

      {error && (
        <p className="mt-3 rounded-[10px] border border-bad/30 bg-bad-wash px-3 py-2 text-[0.875rem] text-bad">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onSave} disabled={saving}
          className="pill pill-mint py-2 text-[0.875rem] disabled:opacity-60">
          {saving ? "Saving…" : isNew ? "Add it" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="pill pill-ghost py-2 text-[0.875rem]">
          Cancel
        </button>
        {onRetire && (
          <button type="button" onClick={onRetire}
            className="pill py-2 text-[0.875rem] text-bad" style={{ borderColor: "currentColor" }}>
            Hide this item
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function ConsolePanel({
  who, games, items, reports = [], support = [], templates = [], library = [],
  levelUps = [],
}: {
  who: string;
  games: ConsoleGame[];
  items: ConsoleItem[];
  reports?: readonly AdminReport[];
  support?: readonly SupportMessage[];
  templates?: readonly StudioTemplate[];
  library?: readonly MediaRow[];
  levelUps?: readonly LevelUpRow[];
}) {
  const [rows, setRows] = useState(items);
  const [game, setGame] = useState(games[0]?.slug ?? "");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const inGame = useMemo(() => rows.filter((r) => r.game_slug === game), [rows, game]);
  const categories = useMemo(
    () => [...new Set(inGame.map((r) => r.category ?? "").filter(Boolean))].sort(),
    [inGame],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inGame.filter((r) =>
      (!category || r.category === category) &&
      (!q ||
        r.name.toLowerCase().includes(q) ||
        arr(r.attributes?.aliases).some((a) => a.toLowerCase().includes(q)) ||
        arr(r.attributes?.formerly).some((a) => a.toLowerCase().includes(q))),
    );
  }, [inGame, query, category]);

  /** Things a skin can belong to, named so nobody has to know what a slug is. */
  const parents = useMemo(
    () => inGame
      .filter((r) => str(r.attributes?.slug) && r.category !== "Skin")
      .map((r) => ({ slug: str(r.attributes?.slug), name: r.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [inGame],
  );

  function commit(d: ItemDraft) {
    setError(null);
    startSaving(async () => {
      const result = await saveItem(d);
      if (!result.ok) { setError(result.error); return; }
      const attrs: Record<string, unknown> = {
        ...(rows.find((r) => r.id === result.id)?.attributes ?? {}),
        rarity: d.rarity || undefined, type: d.type || undefined,
        aliases: (d.aliases ?? "").split(",").map((s) => s.trim()).filter(Boolean),
        formerly: (d.formerly ?? "").split(",").map((s) => s.trim()).filter(Boolean),
        chromatic: d.chromatic || undefined,
        tradeable: d.tradeable === false ? false : undefined,
        parentSlug: d.parentSlug || undefined, note: d.note || undefined,
        art: d.art || undefined,
        beli: d.beli ?? undefined, robux: d.robux ?? undefined,
        // valuePhysical / valuePermanent / demand are deliberately absent.
        // This object only mirrors what the server just wrote so the row
        // updates without a refetch, and the server drops those keys on every
        // save — see attributesFrom in lib/admin/actions.ts. Rows nobody edits
        // are cleared by the schema on the next apply.
      };
      const next: ConsoleItem = {
        id: result.id!, game_slug: d.gameSlug, name: d.name.trim(),
        category: d.category.trim(), attributes: attrs, is_active: true,
      };
      setRows((prev) =>
        prev.some((r) => r.id === next.id)
          ? prev.map((r) => (r.id === next.id ? next : r))
          : [...prev, next].sort((a, b) => a.name.localeCompare(b.name)));
      setOpenId(null); setDraft(null); setAdding(false);
    });
  }

  function retire(id: string) {
    startSaving(async () => {
      const result = await setItemActive(id, false);
      if (!result.ok) { setError(result.error); return; }
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: false } : r)));
      setOpenId(null); setDraft(null);
    });
  }

  const current = games.find((g) => g.slug === game);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6">
      <header className="mb-6 border-b border-line pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-mint">
              Signed in as {who}
            </p>
            <h1 className="mt-1 text-[1.75rem] font-extrabold tracking-[-0.03em] text-ink">
              Control panel
            </h1>
          </div>
          <button type="button" onClick={() => { void lockConsole().then(() => location.assign("/app")); }}
            className="pill pill-ghost shrink-0 py-2 text-[0.8125rem]">
            Lock
          </button>
        </div>
        <p className="mt-2 max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">
          Pick a game, then change anything you like — a price, what something
          trades for, its picture, or add something the game just added. It goes
          live the moment you save, and everything you change is kept on record so
          a mistake can be put back.
        </p>
      </header>

      {/* ---- game picker ---- */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {games.map((g) => (
          <button key={g.slug} type="button"
            onClick={() => { setGame(g.slug); setCategory(null); setQuery(""); setOpenId(null); setAdding(false); }}
            aria-pressed={g.slug === game}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[0.8125rem] font-bold transition-colors ${
              g.slug === game
                ? "border-ink bg-ink text-surface"
                : "border-line bg-surface text-ink-mute hover:border-mint"
            }`}>
            <span className="h-2 w-2 rounded-full" style={{ background: g.hue ?? "#888" }} />
            {g.short_name}
          </button>
        ))}
      </div>

      {/* ---- what this game looks like ---- */}
      {current && <GameSettings key={current.slug} game={current} />}

      {/* ---- items ---- */}
      <section className="mt-7">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">Everything in this game</h2>
          <p className="font-mono text-[0.625rem] tracking-[0.07em] text-ink-faint">
            {inGame.length} THINGS
          </p>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Find something by name" className={`${inputClass} min-w-0 flex-1`} />
          <button type="button"
            onClick={() => {
              setAdding(true); setOpenId(null); setError(null);
              setDraft(blankDraft(game, category ?? categories[0] ?? "Fruit"));
            }}
            className="pill pill-mint shrink-0 py-2 text-[0.875rem]">
            + Add something
          </button>
        </div>

        {categories.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button key={c} type="button" aria-pressed={category === c}
                onClick={() => setCategory(category === c ? null : c)}
                className={`rounded-full border px-2.5 py-1 font-mono text-[0.5625rem] tracking-[0.07em] transition-colors ${
                  category === c ? "border-mint bg-mint-wash text-mint" : "border-line text-ink-mute"
                }`}>
                {c.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {adding && draft && (
          <div className="mb-3 overflow-hidden rounded-[var(--radius-panel)] border border-mint bg-surface">
            <p className="px-3 pt-3 font-mono text-[0.625rem] tracking-[0.1em] text-mint">SOMETHING NEW</p>
            <ItemEditor draft={draft} onChange={setDraft} isNew saving={saving} error={error}
              categories={categories} parents={parents}
              onSave={() => commit(draft)}
              onCancel={() => { setAdding(false); setDraft(null); setError(null); }} />
          </div>
        )}

        <ul className="grid gap-2">
          {shown.map((r) => {
            const a = r.attributes ?? {};
            const open = openId === r.id;
            return (
              <li key={r.id}
                className={`overflow-hidden rounded-[var(--radius-panel)] border bg-surface ${
                  open ? "border-mint" : "border-line"
                } ${r.is_active ? "" : "opacity-60"}`}>
                <button type="button"
                  onClick={() => {
                    if (open) { setOpenId(null); setDraft(null); }
                    else { setOpenId(r.id); setDraft(draftFrom(r)); setAdding(false); setError(null); }
                  }}
                  className="flex w-full items-center gap-3 p-3 text-left">
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-line-soft bg-fill font-mono text-[0.6875rem] font-bold text-ink-mute">
                    {str(a.art)
                      ? /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={str(a.art)} alt="" className="h-full w-full object-contain" />
                      : r.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-bold tracking-[-0.015em] text-ink">
                      {r.name}
                      {!r.is_active && <span className="ml-2 font-mono text-[0.5625rem] text-warn">RETIRED</span>}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[0.5625rem] tracking-[0.07em] text-ink-faint">
                      {r.category && <span>{r.category.toUpperCase()}</span>}
                      {str(a.rarity) && <span>· {str(a.rarity).toUpperCase()}</span>}
                      {str(a.type) && <span>· {str(a.type).toUpperCase()}</span>}
                      {a.tradeable === false && <span className="text-warn">· NOT TRADEABLE</span>}
                    </span>
                  </span>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`shrink-0 text-ink-faint transition-transform ${open ? "rotate-90" : ""}`}>
                    <path d="M6 3.5 10.5 8 6 12.5" />
                  </svg>
                </button>

                {open && draft && (
                  <ItemEditor draft={draft} onChange={setDraft} isNew={false} saving={saving} error={error}
                    categories={categories} parents={parents}
                    onSave={() => commit(draft)}
                    onCancel={() => { setOpenId(null); setDraft(null); setError(null); }}
                    onRetire={r.is_active ? () => retire(r.id) : undefined} />
                )}
              </li>
            );
          })}
        </ul>

        {shown.length === 0 && (
          <p className="rounded-[var(--radius-panel)] border border-dashed border-line px-4 py-10 text-center text-[0.9375rem] text-ink-mute">
            Nothing here by that name. Clear the search, or add it as something new.
          </p>
        )}
      </section>

      <Studio games={games} templates={templates} library={library} />

      <ReportsPanel reports={reports} />

      <SupportPanel messages={support} />

      <LevelUpPanel rows={levelUps} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function GameSettings({ game }: { game: ConsoleGame }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(game.name);
  const [blurb, setBlurb] = useState(game.blurb ?? "");
  const [hue, setHue] = useState(game.hue ?? "");
  const [art, setArt] = useState(game.art ?? "");
  const [saved, setSaved] = useState(false);
  const [tabs, setTabs] = useState<ExploreTabDraft[]>(
    (game.explore_tabs ?? []).map((t) => ({
      id: t.id,
      label: t.label,
      blurb: t.blurb ?? "",
      kind: (t.kind as ExploreTabDraft["kind"]) ?? "trades",
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  return (
    <details className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface"
      open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer list-none px-3 py-3 text-[0.9375rem] font-bold text-ink marker:hidden [&::-webkit-details-marker]:hidden">
        How {game.short_name} looks on the site
      </summary>
      <div className="border-t border-line-soft px-3 pb-4 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className={inputClass} value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }} /></Field>
          <Field label="Colour" hint="Tap to pick the colour used for this game.">
            <span className="flex items-center gap-2">
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(hue) ? hue : "#888888"}
                onChange={(e) => { setHue(e.target.value); setSaved(false); }}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-[10px] border border-line bg-surface p-1" />
              <input className={inputClass} value={hue} aria-label="Colour code"
                onChange={(e) => { setHue(e.target.value); setSaved(false); }} />
            </span></Field>
        </div>
        <div className="mt-3">
          <Field label="One line about the game" hint="Shown on the homepage card.">
            <textarea className={`${inputClass} min-h-[4.5rem]`} value={blurb}
              onChange={(e) => { setBlurb(e.target.value); setSaved(false); }} /></Field>
        </div>
        <div className="mt-3">
          <Field label="Cover picture">
            <ArtUpload value={art} onChange={(url) => { setArt(url); setSaved(false); }}
              itemName={`${game.slug}-cover`} /></Field>
        </div>

        {/* ---- what this game calls its three tabs ----

            Only the names change. What sits behind each tab is one of three
            engines and there is no fourth, so the kind is shown and locked
            while the label is yours. */}
        {tabs.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-[0.8125rem] font-semibold text-ink">Tab names</p>
            <p className="mb-2 text-[0.75rem] leading-relaxed text-ink-mute">
              What this game calls each board. A fishing game does not have to
              say &ldquo;raids&rdquo; just because another game does.
            </p>
            <div className="grid gap-2">
              {tabs.map((t, i) => (
                <div key={t.id} className="flex items-center gap-2">
                  <span className="w-[4.5rem] shrink-0 font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
                    {t.kind.toUpperCase()}
                  </span>
                  <input
                    className={inputClass}
                    value={t.label}
                    aria-label={`Name for the ${t.kind} tab`}
                    maxLength={40}
                    onChange={(e) => {
                      const next = [...tabs];
                      next[i] = { ...t, label: e.target.value };
                      setTabs(next);
                      setSaved(false);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button type="button" disabled={saving}
            onClick={() => start(async () => {
              setError(null);
              await saveGame(game.slug, { name, blurb, hue, art });
              if (tabs.length > 0) {
                const r = await saveExploreTabs(game.slug, tabs);
                if (!r.ok) { setError(r.error); return; }
              }
              setSaved(true);
            })}
            className="pill pill-mint py-2 text-[0.875rem] disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span className="font-mono text-[0.625rem] tracking-[0.08em] text-mint">SAVED</span>}
          {error && <span role="alert" className="text-[0.8125rem] text-bad">{error}</span>}
        </div>
      </div>
    </details>
  );
}
