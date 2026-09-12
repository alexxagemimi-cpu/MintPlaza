"use client";

import { useMemo, useState, useTransition } from "react";
import {
  saveTemplate, setTemplateActive, saveGameFull, setGameActive, reorderGames,
  addMedia, deleteMedia,
  type TemplateDraft, type GameDraft, type ExploreTabDraft,
} from "@/lib/admin/actions";
import type { StudioTemplate, MediaRow } from "@/lib/data/templates";
import type { ConsoleGame } from "./ConsolePanel";

/**
 * The Studio.
 *
 * The control panel next door edits what things are *worth*. This edits what
 * things *are*: which games exist, what each calls its boards, and every list
 * template people can post from.
 *
 * ---------------------------------------------------------------------------
 * The line this draws, and why it is drawn there
 * ---------------------------------------------------------------------------
 *
 * Everything here is content. Names, pictures, requirements, crew sizes, what a
 * tab is called, which games are listed — all of it changes when a game ships
 * an update, and none of it should need a developer.
 *
 * What is *not* here: new behaviour. There are three engines behind the three
 * boards — a trade board with a calculator, a services board, a crew board —
 * and this can point a tab at one of them, rename it, and fill it with
 * templates. It cannot invent a fourth. That is a real ceiling, and pretending
 * otherwise would mean building every feature twice, once as code and once as
 * config, and shipping a website builder instead of a matching site.
 *
 * So the rule is: if it is a word, a number or a picture, it is editable here.
 * If it is a behaviour, it is code.
 *
 * ---------------------------------------------------------------------------
 * Things that are deliberately awkward
 * ---------------------------------------------------------------------------
 *
 * Nothing deletes. Games hide, templates retire. Live listings point at these
 * ids, and removing one turns somebody's post into a card about nothing — a bug
 * this project already shipped once and had to fix.
 *
 * The ≤3 / ≥3 split between the boards is enforced on save, with a sentence
 * explaining it rather than a validation error. It is the one rule that keeps
 * the two boards from collapsing into each other.
 *
 * And a template edited here gets a database row that overrides the code one.
 * Untouched templates have no row at all — which is why "Reset to built-in" is
 * possible and why there is no seeding step to drift out of date.
 */

const KINDS = [
  "Raid", "Trial", "Puzzle", "Boss", "Unlock",
  "Grind", "Island", "Crew", "Event", "Hunt",
] as const;

const MODULES = ["trades", "inventory", "activities", "help", "services"] as const;

const TAB_KINDS = [
  { kind: "trades", what: "Trading board, with the W/F/L calculator" },
  { kind: "services", what: "One or two people helping somebody who is stuck" },
  { kind: "community", what: "Crews of three or more forming" },
] as const;

const input =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[0.9375rem] text-ink outline-none focus:border-mint";

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.8125rem] font-semibold text-ink">{label}</span>
      {hint && <span className="mb-1.5 block text-[0.75rem] leading-relaxed text-ink-mute">{hint}</span>}
      {children}
    </label>
  );
}

function Pills<T extends string | number | null>({
  options, value, onChange, render,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o)} type="button" onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={`rounded-full border px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
            value === o ? "border-mint bg-mint-wash text-ink" : "border-line bg-surface text-ink-mute"
          }`}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Picture picker                                                     */
/* ------------------------------------------------------------------ */

/**
 * Pick from the shelf, or paste an address.
 *
 * The shelf is the point: the Angel race is uploaded once and reused on every
 * template that needs it, so re-skinning it later is one replacement rather
 * than four.
 */
function PicturePicker({
  value, onChange, library, gameSlug, label = "Picture",
}: {
  value: string;
  onChange: (url: string) => void;
  library: readonly MediaRow[];
  gameSlug?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  // This game's pictures first, then everything else — the shelf is shared, but
  // the thing you want is almost always from the game you are looking at.
  const sorted = useMemo(() => {
    const mine = library.filter((m) => m.game_slug === gameSlug);
    const rest = library.filter((m) => m.game_slug !== gameSlug);
    return [...mine, ...rest];
  }, [library, gameSlug]);

  return (
    <div>
      <span className="mb-1 block text-[0.8125rem] font-semibold text-ink">{label}</span>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-line bg-fill"
        >
          {value
            ? /* eslint-disable-next-line @next/next/no-img-element */
              <img src={value} alt="" className="h-full w-full object-cover" />
            : <span className="font-mono text-[0.5rem] text-ink-faint">NONE</span>}
        </span>
        <button type="button" onClick={() => setOpen(!open)}
                className="pill pill-ghost py-2 text-[0.8125rem]">
          {open ? "Close" : value ? "Change" : "Choose"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange("")}
                  className="pill pill-ghost py-2 text-[0.8125rem] text-ink-mute">
            Remove
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 rounded-[12px] border border-line bg-fill p-3">
          <p className="mb-2 font-mono text-[0.5rem] tracking-[0.09em] text-ink-faint">
            ON THE SHELF · {sorted.length}
          </p>
          {sorted.length === 0 ? (
            <p className="mb-3 text-[0.8125rem] text-ink-mute">
              Nothing here yet. Add one below and it is available everywhere.
            </p>
          ) : (
            <ul className="mb-3 grid max-h-52 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6">
              {sorted.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(m.url); setOpen(false); }}
                    title={m.label}
                    className={`grid aspect-square w-full place-items-center overflow-hidden rounded-[8px] border ${
                      value === m.url ? "border-mint ring-2 ring-mint/40" : "border-line"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt={m.label} className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mb-1.5 font-mono text-[0.5rem] tracking-[0.09em] text-ink-faint">
            ADD ONE
          </p>
          <div className="grid gap-1.5">
            <input className={input} value={url} placeholder="/art/services/thing.jpg"
                   onChange={(e) => setUrl(e.target.value)} aria-label="Picture address" />
            <input className={input} value={name} placeholder="What it is a picture of"
                   onChange={(e) => setName(e.target.value)} aria-label="Picture name" />
            <button
              type="button" disabled={busy || !url.trim()}
              onClick={() => start(async () => {
                setError(null);
                const r = await addMedia(url, name || url, "service", gameSlug);
                if (!r.ok) { setError(r.error); return; }
                onChange(url.trim());
                setUrl(""); setName(""); setOpen(false);
              })}
              className="pill pill-mint py-2 text-[0.8125rem] disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add and use it"}
            </button>
          </div>
          {error && <p role="alert" className="mt-2 text-[0.8125rem] text-bad">{error}</p>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reference pictures on a template                                   */
/* ------------------------------------------------------------------ */

/**
 * The +/− the owner asked for.
 *
 * Some templates mean different jobs depending on a detail the game cares about
 * — a V3 listing is a different evening for an Angel than for a Ghoul. These
 * are the choices a poster gets, and the number of them is not fixed because
 * the number of races is not fixed either.
 */
function RefEditor({
  refs, onChange, library, gameSlug,
}: {
  refs: { id: string; label: string; hue?: string; art?: string }[];
  onChange: (next: { id: string; label: string; hue?: string; art?: string }[]) => void;
  library: readonly MediaRow[];
  gameSlug: string;
}) {
  function set(i: number, patch: Partial<{ id: string; label: string; hue: string; art: string }>) {
    const next = [...refs];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-[0.8125rem] font-semibold text-ink">Pictures a poster can pick</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="One fewer picture"
            disabled={refs.length === 0}
            onClick={() => onChange(refs.slice(0, -1))}
            className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink-mute disabled:opacity-40"
          >
            −
          </button>
          <span className="w-6 text-center font-mono text-[0.75rem] tabular-nums text-ink">
            {refs.length}
          </span>
          <button
            type="button"
            aria-label="One more picture"
            disabled={refs.length >= 12}
            onClick={() => onChange([...refs, { id: `ref-${refs.length + 1}`, label: "" }])}
            className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink-mute disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
      <p className="mb-2 text-[0.75rem] leading-relaxed text-ink-mute">
        Leave this empty unless the template means different things to different
        people. Six races on a V3 quest, yes. A boss that is always the same
        boss, no.
      </p>

      {refs.length > 0 && (
        <ul className="grid gap-2">
          {refs.map((r, i) => (
            <li key={i} className="rounded-[12px] border border-line-soft bg-surface p-2.5">
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={input} value={r.label} placeholder="Angel"
                       aria-label={`Name of picture ${i + 1}`}
                       onChange={(e) => set(i, { label: e.target.value })} />
                <input className={input} value={r.id} placeholder="race-angel"
                       aria-label={`Id of picture ${i + 1}`}
                       onChange={(e) => set(i, { id: e.target.value.trim() })} />
              </div>
              <div className="mt-2">
                <PicturePicker
                  value={r.art ?? ""} label="Its picture"
                  onChange={(url) => set(i, { art: url })}
                  library={library} gameSlug={gameSlug}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  One template                                                       */
/* ------------------------------------------------------------------ */

function TemplateEditor({
  template, games, library, onSaved,
}: {
  template: StudioTemplate;
  games: readonly ConsoleGame[];
  library: readonly MediaRow[];
  onSaved: (t: StudioTemplate) => void;
}) {
  const [d, setD] = useState<TemplateDraft>({
    id: template.id,
    gameSlug: template.gameSlug,
    name: template.name,
    kind: template.kind,
    section: (template.section ?? "services") as "services" | "recruit",
    art: template.art ?? "",
    needs: template.needs ?? "",
    players: template.players ?? null,
    gives: template.gives ?? "",
    openEnded: template.openEnded ?? false,
    aliases: [...(template.aliases ?? [])],
    refs: (template.refs ?? []).map((r) => ({ ...r })),
    verified: template.verified ?? true,
    isActive: template.isActive,
    sortOrder: template.sortOrder,
    everyoneRewarded: template.everyoneRewarded,
    isDraft: template.draft ?? false,
    group: template.group ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, start] = useTransition();

  const patch = (p: Partial<TemplateDraft>) => { setD({ ...d, ...p }); setSaved(false); setError(null); };

  return (
    <div className="border-t border-line-soft bg-fill px-3 pb-4 pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className={input} value={d.name}
          onChange={(e) => patch({ name: e.target.value })} /></Field>
        <Field label="Which game">
          <select className={input} value={d.gameSlug}
                  onChange={(e) => patch({ gameSlug: e.target.value })}>
            {games.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Which board"
               hint="Raids & Services is one or two helpers. Help & Recruitment is three or more, because the game will not start with fewer.">
          <Pills
            options={["services", "recruit"] as const}
            value={d.section}
            onChange={(v) => patch({ section: v })}
            render={(v) => (v === "services" ? "Raids & Services" : "Help & Recruitment")}
          />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Kind">
          <Pills options={KINDS} value={d.kind as typeof KINDS[number]}
                 onChange={(v) => patch({ kind: v })} render={(v) => v} />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="How many players in total"
               hint="Including the person asking. Leave off if it varies.">
          <Pills
            options={[null, 2, 3, 4, 5, 6, 8, 10] as (number | null)[]}
            value={d.players ?? null}
            onChange={(v) => patch({ players: v })}
            render={(v) => (v === null ? "Varies" : String(v))}
          />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="What the game requires"
               hint="The game's rule, not ours. One sentence, and only if you are sure of it.">
          <textarea className={`${input} min-h-[5rem]`} value={d.needs ?? ""}
                    onChange={(e) => patch({ needs: e.target.value })} />
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="What they walk away with">
          <input className={input} value={d.gives ?? ""}
                 onChange={(e) => patch({ gives: e.target.value })} />
        </Field>
        <Field label="Other names people search"
               hint="Commas between them. Never shown, only searched.">
          <input className={input} value={(d.aliases ?? []).join(", ")}
                 onChange={(e) => patch({ aliases: e.target.value.split(",").map((x) => x.trim()) })} />
        </Field>
      </div>

      <div className="mt-3">
        <PicturePicker value={d.art ?? ""} onChange={(url) => patch({ art: url })}
                       library={library} gameSlug={d.gameSlug}
                       label="Picture on the card" />
      </div>

      <div className="mt-4">
        <RefEditor refs={d.refs ?? []} onChange={(refs) => patch({ refs })}
                   library={library} gameSlug={d.gameSlug} />
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[0.8125rem] text-ink">
          <input type="checkbox" checked={d.openEnded ?? false}
                 onChange={(e) => patch({ openEnded: e.target.checked })} />
          The poster fills in the specifics
        </label>
        <label className="flex items-center gap-2 text-[0.8125rem] text-ink">
          <input type="checkbox" checked={d.verified ?? true}
                 onChange={(e) => patch({ verified: e.target.checked })} />
          I have checked this against the game
        </label>
        <label className="flex items-center gap-2 text-[0.8125rem] text-ink">
          <input type="checkbox" checked={d.isDraft ?? false}
                 onChange={(e) => patch({ isDraft: e.target.checked })} />
          Keep it off the board for now
        </label>
      </div>

      {/* The reward question. It gets a panel of its own rather than a third
          checkbox in the row above, because it is the only control on this
          screen that can decide whether a stranger wastes their evening. */}
      <div className="mt-4 rounded-[12px] border border-line bg-sunk p-3.5">
        <p className="text-[0.8125rem] font-bold text-ink">
          If fifteen people answer this post, what do they get?
        </p>
        <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-mute">
          Half the group content in these games is secretly a race — a hunt that
          ends on the first catch, a leaderboard that pays rank one. Recruiting
          for one of those means gathering people to lose. Until this says
          everyone, a recruitment template will not appear on the board.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {([
            [true, "Everyone who took part"],
            [false, "One winner, or only the poster"],
            [undefined, "I have not checked"],
          ] as const).map(([value, label]) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => patch({ everyoneRewarded: value })}
              aria-pressed={d.everyoneRewarded === value}
              className={`rounded-full px-3 py-1.5 text-[0.75rem] font-semibold transition-colors ${
                d.everyoneRewarded === value
                  ? "bg-ink text-white"
                  : "bg-surface text-ink-soft shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-fill"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {d.section === "recruit" && d.everyoneRewarded !== true && (
          <p className="mt-2.5 text-[0.75rem] font-semibold text-warn">
            This will save, and it will not be offered on the recruitment board.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-[10px] border border-bad/30 bg-bad-wash px-3 py-2 text-[0.8125rem] leading-relaxed text-bad">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button" disabled={busy}
          onClick={() => start(async () => {
            const r = await saveTemplate(d);
            if (!r.ok) { setError(r.error); return; }
            setSaved(true);
            onSaved({
              ...template,
              ...d,
              // The form keeps an empty string where there is no group; the
              // catalogue shape wants that absent rather than blank.
              group: d.group?.trim() || undefined,
              draft: d.isDraft ?? false,
              // The draft's kind is a plain string because the form binds it to
              // one; the list has already refused anything outside KINDS, and
              // the database refuses it again.
              kind: d.kind as StudioTemplate["kind"],
              art: d.art || undefined,
              needs: d.needs || undefined,
              gives: d.gives || undefined,
              players: d.players ?? undefined,
              aliases: (d.aliases ?? []).filter(Boolean),
              refs: d.refs,
              isActive: d.isActive ?? true,
              edited: true,
            });
          })}
          className="pill pill-mint py-2 text-[0.875rem] disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {saved && <span className="font-mono text-[0.625rem] tracking-[0.08em] text-mint">SAVED</span>}

        <button
          type="button" disabled={busy}
          onClick={() => start(async () => {
            const next = !(d.isActive ?? true);
            const r = await setTemplateActive(d.id, next);
            if (!r.ok) { setError(r.error); return; }
            patch({ isActive: next });
            onSaved({ ...template, isActive: next, edited: true });
          })}
          className="pill pill-ghost ml-auto py-2 text-[0.875rem] disabled:opacity-60"
        >
          {d.isActive ?? true ? "Retire it" : "Bring it back"}
        </button>
      </div>

      <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-faint">
        Retiring hides it from the post form. It never deletes — live posts point
        at this, and removing it would leave somebody with a card about nothing.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Games                                                              */
/* ------------------------------------------------------------------ */

function GameEditor({
  game, library, onDone,
}: {
  game: ConsoleGame | null;
  library: readonly MediaRow[];
  onDone: () => void;
}) {
  const blank: GameDraft = {
    slug: "", name: "", shortName: "", blurb: "", hue: "#3ED8A3", art: "",
    modules: ["trades", "services", "help"],
    exploreTabs: [
      { id: "trades", label: "Trade & Offers", kind: "trades", blurb: "" },
      { id: "raids", label: "Raids & Services", kind: "services", blurb: "" },
      { id: "community", label: "Help & Recruitment", kind: "community", blurb: "" },
    ],
    isActive: true,
  };

  const [d, setD] = useState<GameDraft>(
    game
      ? {
          slug: game.slug, name: game.name, shortName: game.short_name,
          blurb: game.blurb ?? "", hue: game.hue ?? "", art: game.art ?? "",
          modules: [...MODULES],
          exploreTabs: (game.explore_tabs ?? []).map((t) => ({
            id: t.id, label: t.label, blurb: t.blurb ?? "",
            kind: t.kind as ExploreTabDraft["kind"],
          })),
          isActive: true,
        }
      : blank,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, start] = useTransition();
  const patch = (p: Partial<GameDraft>) => { setD({ ...d, ...p }); setSaved(false); setError(null); };

  return (
    <div className="rounded-[var(--radius-panel)] border border-line bg-surface p-4">
      <h3 className="text-[1rem] font-bold tracking-[-0.02em] text-ink">
        {game ? `Edit ${game.name}` : "Add a game"}
      </h3>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-mute">
        A new game plugs into the boards that already exist. That is what makes
        this an afternoon rather than a project — the engines are built, and a
        game is what you fill them with.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className={input} value={d.name}
          onChange={(e) => patch({ name: e.target.value })} /></Field>
        <Field label="Short name" hint="Used where space is tight.">
          <input className={input} value={d.shortName ?? ""}
                 onChange={(e) => patch({ shortName: e.target.value })} /></Field>
      </div>

      <div className="mt-3">
        <Field label="Web address part"
               hint={game ? "Cannot change once people have posted to it." : "Lowercase letters, numbers and dashes. mintplaza.com/app/THIS"}>
          <input className={input} value={d.slug} disabled={Boolean(game)}
                 onChange={(e) => patch({ slug: e.target.value.toLowerCase() })} /></Field>
      </div>

      <div className="mt-3">
        <Field label="One line about it"><textarea className={`${input} min-h-[4rem]`}
          value={d.blurb ?? ""} onChange={(e) => patch({ blurb: e.target.value })} /></Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Colour">
          <span className="flex items-center gap-2">
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(d.hue ?? "") ? d.hue : "#3ED8A3"}
                   onChange={(e) => patch({ hue: e.target.value })}
                   className="h-11 w-14 shrink-0 cursor-pointer rounded-[10px] border border-line bg-surface p-1" />
            <input className={input} value={d.hue ?? ""} aria-label="Colour code"
                   onChange={(e) => patch({ hue: e.target.value })} />
          </span>
        </Field>
        <PicturePicker value={d.art ?? ""} onChange={(url) => patch({ art: url })}
                       library={library} gameSlug={d.slug} label="Cover picture" />
      </div>

      <div className="mt-4">
        <span className="mb-1 block text-[0.8125rem] font-semibold text-ink">Its tabs</span>
        <p className="mb-2 text-[0.75rem] leading-relaxed text-ink-mute">
          Three boards exist and there is no fourth. What each is <em>called</em>
          {" "}is yours — a fishing game does not have to advertise raids.
        </p>
        <div className="grid gap-2">
          {(d.exploreTabs ?? []).map((t, i) => (
            <div key={t.kind} className="rounded-[10px] border border-line-soft bg-fill p-2.5">
              <p className="mb-1 font-mono text-[0.5rem] tracking-[0.09em] text-ink-faint">
                {TAB_KINDS.find((k) => k.kind === t.kind)?.what ?? t.kind.toUpperCase()}
              </p>
              <input className={input} value={t.label}
                     aria-label={`Name for the ${t.kind} tab`}
                     onChange={(e) => {
                       const next = [...(d.exploreTabs ?? [])];
                       next[i] = { ...t, label: e.target.value };
                       patch({ exploreTabs: next });
                     }} />
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-[10px] border border-bad/30 bg-bad-wash px-3 py-2 text-[0.8125rem] text-bad">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button type="button" disabled={busy}
          onClick={() => start(async () => {
            const r = await saveGameFull(d);
            if (!r.ok) { setError(r.error); return; }
            setSaved(true);
            onDone();
          })}
          className="pill pill-mint py-2 text-[0.875rem] disabled:opacity-60">
          {busy ? "Saving…" : game ? "Save" : "Add it"}
        </button>
        {saved && <span className="font-mono text-[0.625rem] tracking-[0.08em] text-mint">SAVED</span>}
        <button type="button" onClick={onDone}
                className="pill pill-ghost ml-auto py-2 text-[0.875rem]">
          Close
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type View = "templates" | "games" | "pictures";

export function Studio({
  games, templates: initial, library,
}: {
  games: readonly ConsoleGame[];
  templates: readonly StudioTemplate[];
  library: readonly MediaRow[];
}) {
  const [view, setView] = useState<View>("templates");
  const [templates, setTemplates] = useState<StudioTemplate[]>([...initial]);
  const [game, setGame] = useState(games[0]?.slug ?? "");
  const [section, setSection] = useState<"services" | "recruit">("services");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingGame, setEditingGame] = useState<ConsoleGame | null | undefined>(undefined);
  const [showRetired, setShowRetired] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates
      .filter((t) => t.gameSlug === game)
      .filter((t) => (t.section ?? "services") === section)
      .filter((t) => showRetired || t.isActive)
      .filter((t) => !q || t.name.toLowerCase().includes(q) ||
        t.aliases?.some((a) => a.toLowerCase().includes(q)));
  }, [templates, game, section, query, showRetired]);

  const retiredCount = templates.filter(
    (t) => t.gameSlug === game && (t.section ?? "services") === section && !t.isActive,
  ).length;

  function replace(t: StudioTemplate) {
    setTemplates((prev) => {
      const i = prev.findIndex((x) => x.id === t.id);
      if (i === -1) return [...prev, t];
      const next = [...prev];
      next[i] = t;
      return next;
    });
  }

  return (
    <section className="mt-8">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[1.25rem] font-extrabold tracking-[-0.03em] text-ink">Studio</h2>
        <span className="font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
          {templates.length} TEMPLATES · {games.length} GAMES · {library.length} PICTURES
        </span>
      </div>
      <p className="mb-4 max-w-[68ch] text-[0.875rem] leading-relaxed text-ink-mute">
        The panel above changes what things are worth. This changes what things
        are — which games exist, what each calls its boards, and every list
        people can post from. Words, numbers and pictures are yours; behaviour is
        code.
      </p>

      <div className="mb-4 flex gap-2">
        {(["templates", "games", "pictures"] as View[]).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)}
            aria-pressed={view === v}
            className={`rounded-full border px-4 py-2 text-[0.875rem] font-bold capitalize transition-colors ${
              view === v ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink-mute"
            }`}>
            {v}
          </button>
        ))}
      </div>

      {/* ---------------- templates ---------------- */}
      {view === "templates" && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={input} value={game} onChange={(e) => { setGame(e.target.value); setOpenId(null); }}
                    aria-label="Which game">
              {games.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
            </select>
            <select className={input} value={section}
                    onChange={(e) => { setSection(e.target.value as "services" | "recruit"); setOpenId(null); }}
                    aria-label="Which board">
              <option value="services">Raids &amp; Services</option>
              <option value="recruit">Help &amp; Recruitment</option>
            </select>
          </div>

          <input className={`${input} mt-2`} value={query} placeholder="Search templates"
                 aria-label="Search templates" onChange={(e) => setQuery(e.target.value)} />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button"
              onClick={() => {
                const t: StudioTemplate = {
                  id: "", gameSlug: game, name: "", kind: "Grind",
                  section, isActive: true, edited: false, sortOrder: 999,
                };
                setTemplates((p) => [...p, t]);
                setOpenId("");
              }}
              className="pill pill-mint py-2 text-[0.875rem]">
              New template
            </button>
            {retiredCount > 0 && (
              <label className="flex items-center gap-2 text-[0.8125rem] text-ink-mute">
                <input type="checkbox" checked={showRetired}
                       onChange={(e) => setShowRetired(e.target.checked)} />
                Show {retiredCount} retired
              </label>
            )}
          </div>

          <ul className="mt-3 grid gap-2">
            {shown.map((t) => (
              <li key={t.id || "new"}
                  className={`overflow-hidden rounded-[var(--radius-inner)] border bg-surface ${
                    t.isActive ? "border-line" : "border-dashed border-line opacity-70"
                  }`}>
                <button type="button"
                  onClick={() => setOpenId(openId === t.id ? null : t.id)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left">
                  <span aria-hidden="true"
                    className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-line bg-fill">
                    {t.art
                      ? /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={t.art} alt="" className="h-full w-full object-cover" />
                      : <span className="font-mono text-[0.4375rem] text-ink-faint">
                          {t.kind.slice(0, 4).toUpperCase()}
                        </span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-bold text-ink">
                      {t.name || "Untitled template"}
                    </span>
                    <span className="mt-0.5 block font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
                      {t.kind.toUpperCase()}
                      {t.players ? ` · ${t.players}P` : ""}
                      {t.refs?.length ? ` · ${t.refs.length} PICTURES` : ""}
                      {!t.isActive && " · RETIRED"}
                      {t.edited && " · EDITED"}
                    </span>
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-ink-faint">
                    {openId === t.id ? "−" : "+"}
                  </span>
                </button>
                {openId === t.id && (
                  <TemplateEditor template={t} games={games} library={library} onSaved={replace} />
                )}
              </li>
            ))}
          </ul>

          {shown.length === 0 && (
            <p className="mt-3 rounded-[var(--radius-panel)] border border-dashed border-line px-4 py-10 text-center text-[0.9375rem] text-ink-mute">
              Nothing on this board yet. Add the first one.
            </p>
          )}
        </>
      )}

      {/* ---------------- games ---------------- */}
      {view === "games" && (
        <div className="grid gap-3">
          {editingGame !== undefined ? (
            <GameEditor game={editingGame} library={library}
                        onDone={() => setEditingGame(undefined)} />
          ) : (
            <>
              <button type="button" onClick={() => setEditingGame(null)}
                      className="pill pill-mint w-full py-2.5 text-[0.875rem] sm:w-auto">
                Add a game
              </button>
              <ul className="grid gap-2">
                {games.map((g) => (
                  <li key={g.slug}>
                    <button type="button" onClick={() => setEditingGame(g)}
                      className="glass flex w-full items-center gap-3 rounded-[var(--radius-inner)] p-3 text-left">
                      <span aria-hidden="true"
                        className="h-10 w-10 shrink-0 rounded-[10px]"
                        style={{ background: g.hue ?? "#DDE5E1" }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem] font-bold text-ink">{g.name}</span>
                        <span className="mt-0.5 block font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
                          /{g.slug} · {(g.explore_tabs ?? []).length || 3} TABS ·{" "}
                          {templates.filter((t) => t.gameSlug === g.slug).length} TEMPLATES
                        </span>
                      </span>
                      <span aria-hidden="true" className="shrink-0 text-ink-faint">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* ---------------- pictures ---------------- */}
      {view === "pictures" && <PictureShelf library={library} games={games} />}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function PictureShelf({
  library, games,
}: { library: readonly MediaRow[]; games: readonly ConsoleGame[] }) {
  const [rows, setRows] = useState<MediaRow[]>([...library]);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [gameSlug, setGameSlug] = useState(games[0]?.slug ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <div>
      <p className="mb-3 max-w-[62ch] text-[0.8125rem] leading-relaxed text-ink-mute">
        One shelf for the whole site. Upload the Angel race once and it is
        available on every template that needs it — so when the game re-skins it,
        you replace one picture instead of four.
      </p>

      <div className="rounded-[var(--radius-inner)] border border-line bg-surface p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <input className={input} value={url} placeholder="/art/services/thing.jpg"
                 aria-label="Picture address" onChange={(e) => setUrl(e.target.value)} />
          <input className={input} value={label} placeholder="What it is"
                 aria-label="Picture name" onChange={(e) => setLabel(e.target.value)} />
          <select className={input} value={gameSlug} aria-label="Which game"
                  onChange={(e) => setGameSlug(e.target.value)}>
            {games.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
          </select>
        </div>
        <button type="button" disabled={busy || !url.trim()}
          onClick={() => start(async () => {
            setError(null);
            const r = await addMedia(url, label || url, "service", gameSlug);
            if (!r.ok) { setError(r.error); return; }
            setRows((p) => [
              { id: `local-${Date.now()}`, url: url.trim(), label: label || url.trim(),
                kind: "service", game_slug: gameSlug },
              ...p,
            ]);
            setUrl(""); setLabel("");
          })}
          className="pill pill-mint mt-2 py-2 text-[0.875rem] disabled:opacity-50">
          {busy ? "Adding…" : "Add to the shelf"}
        </button>
        {error && <p role="alert" className="mt-2 text-[0.8125rem] text-bad">{error}</p>}
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-[var(--radius-panel)] border border-dashed border-line px-4 py-10 text-center text-[0.9375rem] text-ink-mute">
          The shelf is empty. Anything you add here shows up in every picture
          picker on the site.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {rows.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-[10px] border border-line bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.label} className="aspect-square w-full object-cover" />
              <div className="px-2 py-1.5">
                <p className="truncate text-[0.6875rem] font-semibold text-ink">{m.label}</p>
                <button type="button"
                  onClick={() => start(async () => {
                    const r = await deleteMedia(m.id);
                    if (r.ok) setRows((p) => p.filter((x) => x.id !== m.id));
                  })}
                  className="mt-0.5 font-mono text-[0.5rem] tracking-[0.08em] text-ink-faint hover:text-bad">
                  REMOVE
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
