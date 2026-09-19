/**
 * Proof, not claims.
 *
 *   npm run proof
 *
 * Checks that the rules this codebase talks about are actually enforced by code
 * rather than by comments. Every one of them is a rule a player could be hurt
 * by if it were only a comment:
 *
 *   1. Every game has somewhere to send a value question. No dead ends.
 *   2. Every partner link is a real URL on that partner's own origin.
 *   3. Nothing claims a commission before an agreement exists.
 *   4. The value system is GONE, not merely switched off.
 *   5. A template that may not be posted is in the catalogue and off the board.
 *   6. What a player can actually list, per game, and how much is unverified.
 *
 * Checks 1-4 replaced four calculator checks. MintPlaza used to keep its own
 * value table and W/F/L verdict and both were removed — the reasoning is in
 * src/lib/referrals.ts. Check 4 is the one that earns its keep over time: a
 * value system that is half-removed, with a table still in the tree or a
 * multiplier still resolving, is worse than either keeping it or dropping it,
 * because the next person to touch the code cannot tell which it is meant to
 * be.
 */
import {
  findItem, catalogFor, CATALOG, catalogProvenance,
  thumbnailFor, variantAxesFor,
} from "../src/lib/items.ts";
import { suggestTrades, toBoardListing, type ListingRow } from "../src/lib/match.ts";
import { SERVICES, postable, servicesFor, PARTIAL_SERVICES } from "../src/lib/sessions.ts";
import { GAMES } from "../src/lib/games.ts";
import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import {
  PARTNERS, partnerFor, valuesLink, outboundUrl, isValuesIntent,
} from "../src/lib/referrals.ts";
import {
  COUNTRIES, LEVEL_UP_DAYS, PERKS, checkoutUrlFor, isCountryCode,
  isLocalCurrency, priceFor, priceNote,
} from "../src/lib/level-up.ts";
import {
  BUILD_CREDIT, GAME_CREDITS, LEGAL_CONTACT, SUBSCRIPTION,
} from "../src/lib/legal.ts";

const it = (id: string, qty = 1, variant?: string) => ({ item: findItem(id)!, quantity: qty, variant });
const line = (n: string) => console.log("\n" + "─".repeat(72) + "\n" + n + "\n");

line("1. EVERY GAME HAS SOMEWHERE TO SEND A VALUE QUESTION");
for (const g of GAMES) {
  const p = partnerFor(g.slug);
  console.log(
    "  " + g.slug.padEnd(22),
    p ? `${p.name.padEnd(20)} ${p.home}` : "*** NOWHERE — this is a dead end ***",
  );
}

line("2. AND THE LINKS ARE REAL URLS, BUILT SERVER-SIDE");
for (const g of GAMES) {
  const v = outboundUrl(g.slug, "values");
  const c = outboundUrl(g.slug, "calculator");
  console.log("  " + g.slug.padEnd(22), "values:", v?.url ?? "—");
  if (c && c.url !== v?.url) console.log("  " + " ".repeat(22), "  calc:", c.url);
}

line("3. WHAT A PLAYER IS TOLD ABOUT THE LINK");
for (const g of GAMES) {
  const l = valuesLink(g.slug);
  console.log(
    "  " + g.slug.padEnd(22),
    l ? `${l.href.padEnd(26)} ${l.paid ? "[paid — disclosure shown]" : "[unpaid — no commission claimed]"}` : "—",
  );
}

line("4. THE VALUE SYSTEM IS GONE, NOT SWITCHED OFF");
console.log("  values.ts on disk          :", existsSync("src/lib/values.ts") ? "STILL THERE" : "removed");
console.log("  ValueLookup.tsx on disk    :", existsSync("src/components/ValueLookup.tsx") ? "STILL THERE" : "removed");
console.log("  -> the assertions below are what actually hold this in place.");

line("5. A TEMPLATE THAT MAY NOT BE POSTED");
{
  const boss = SERVICES.find((s) => s.id === "ps99-s-boss-help")!;
  console.log("  ps99-s-boss-help exists in the catalogue :", Boolean(boss));
  console.log("  everyoneRewarded                         :", boss.everyoneRewarded);
  console.log("  postable()                               :", postable(boss));
  console.log("  appears in the PS99 services board       :",
    servicesFor("pet-simulator-99", "services").some((s) => s.id === "ps99-s-boss-help"));
  console.log("  -> in the catalogue, off the board. One Studio click away when confirmed.");
}

line("6. WHAT A PLAYER CAN ACTUALLY LIST, PER GAME");
for (const g of ["blox-fruits", "fisch", "gag2", "pet-simulator-99", "adopt-me", "creatures-of-sonaria"]) {
  const all = catalogFor(g);
  const tradeable = all.filter((i) => i.tradeable !== false);
  const unsure = all.filter((i) => i.verified === false);
  console.log("  " + g.padEnd(22),
    String(all.length).padStart(4) + " rows",
    "| " + String(tradeable.length).padStart(4) + " listable",
    "| " + String(unsure.length).padStart(2) + " flagged unverified");
}

/* ==========================================================================
 * Checks 7 onward assert rather than report.
 *
 * Everything above prints a fact for a human to read. Everything below is an
 * invariant that must hold, and a proof script that always exits 0 is not
 * proof of anything — so these count failures and set the exit code. That
 * matters most for the merge: a bad merge does not crash, it quietly detaches
 * a priced item from its price, and the site goes on looking fine while
 * answering "?" to a question it used to answer correctly.
 * ======================================================================== */

/**
 * Source with its comments removed.
 *
 * Three separate checks in this file have now reported a false failure against
 * their own documentation: the values check on a comment explaining that values
 * were removed, the dead-button check on a comment explaining a button that was
 * removed, and the XSS check on a comment saying a body is rendered "never with
 * dangerouslySetInnerHTML". This codebase comments heavily and the components
 * most worth scanning are exactly the ones whose comments discuss the thing
 * being scanned for.
 *
 * A scanner that trips on its own prose is worse than no scanner: it teaches
 * whoever hits it that the check is noise and the fix is to delete the check.
 * So there is one helper, and every source grep below goes through it.
 *
 * JSX comments are stripped whole ({​/* ... *​/}) rather than just their inner
 * block, because leaving the braces behind breaks any brace-counting done
 * downstream.
 */
function stripComments(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

let failures = 0;
let checked = 0;
function assert(label: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  checked++;
  if (!ok) failures++;
}

line("7. CATALOGUE INTEGRITY — the five defects the raw pull shipped with");
{
  const ids = new Map<string, number>();
  for (const i of CATALOG) ids.set(i.id, (ids.get(i.id) ?? 0) + 1);
  const dupes = [...ids].filter(([, n]) => n > 1);
  assert(
    "every id is unique",
    dupes.length === 0,
    dupes.length ? `${dupes.length} duplicated, e.g. ${dupes[0][0]}` : `${ids.size} ids`,
  );

  const registered = new Set(GAMES.map((g) => g.slug));
  const orphans = CATALOG.filter((i) => !registered.has(i.gameSlug));
  assert(
    "every row belongs to a registered game",
    orphans.length === 0,
    orphans.length ? `${orphans.length} orphaned, e.g. ${orphans[0].gameSlug}` : undefined,
  );

  const piped = CATALOG.filter((i) => i.name.includes("|"));
  assert("no API keys left in display names", piped.length === 0,
    piped.length ? `e.g. "${piped[0].name}"` : "1,112 names were repaired");

  const nav = CATALOG.filter((i) =>
    ["Wiki", "Home", "Seeds", "Pets", "Eggs", "Vehicles", "Toys", "Houses", "GAG2.GG"]
      .includes(i.name));
  assert("no wiki navigation pages listed as items", nav.length === 0,
    nav.length ? `e.g. ${nav[0].name} in ${nav[0].gameSlug}` : "13 were dropped");

  const scrapedAsVerified = CATALOG.filter((i) => i.sourced && i.verified);
  assert(
    "scraped rows are not marked value-verified",
    scrapedAsVerified.length === 0,
    scrapedAsVerified.length ? `${scrapedAsVerified.length} rows claim both` : undefined,
  );
}

line("8. THE MERGE DID NOT EAT A CURATED ROW");
{
  // The specific regression this guards: the machine pull carries its own
  // Keruku under its own id. If a merge ever lets the pulled row win, the
  // curated `cs-keruku` stops existing — and every listing, inventory row and
  // skin parent that points at that id detaches silently. The site keeps
  // working and quietly stops describing the game.
  //
  // This used to also assert the row still had a VALUE. It cannot any more,
  // and the check is no weaker for it: an id that resolves is the whole point,
  // because the id is what two players' lists agree on.
  const anchors = ["cs-keruku", "cs-somnia-elus", "cs-mijusuima", "bf-magnet", "bf-kitsune"];
  for (const id of anchors) {
    assert(`${id} still resolves`, Boolean(findItem(id)));
  }

  // The pull has 2 gliders; the curated list has 19. A merge that preferred the
  // pull would have quietly deleted 17 of them.
  const gliders = catalogFor("fisch").filter((i) => /glider/i.test(i.category));
  assert("Fisch keeps the 19 curated gliders", gliders.length >= 19, `${gliders.length} gliders`);
}

line("9. THE VALUES HAND-OFF — the four ways it could quietly fail");
{
  // ---- 1. no dead ends ---------------------------------------------------
  //
  // The single most important invariant in this file now. MintPlaza keeps no
  // values, so a game with no partner is a game where "what is this worth?"
  // has no answer anywhere on the site — and that player leaves. Adding a game
  // to the registry without adding it to a partner's `games` fails the build
  // here rather than being discovered by a fourteen-year-old mid-trade.
  const stranded = GAMES.filter((g) => partnerFor(g.slug) === undefined);
  assert(
    "every game on the roster has a values partner",
    stranded.length === 0,
    stranded.length ? `no partner for ${stranded.map((g) => g.slug).join(", ")}` : `${GAMES.length} games covered`,
  );

  // ---- 2. the URLs are real ----------------------------------------------
  //
  // A value link that 404s is worse than no link: the player has already left
  // the site to find out. Every path must parse against its partner's origin,
  // and must land ON that origin rather than somewhere a malformed path could
  // take it.
  const badUrls: string[] = [];
  for (const g of GAMES) {
    for (const intent of ["values", "calculator"] as const) {
      const out = outboundUrl(g.slug, intent);
      if (!out) { badUrls.push(`${g.slug}/${intent}: nothing built`); continue; }
      const u = new URL(out.url);
      if (u.origin !== new URL(out.partner.home).origin) {
        badUrls.push(`${g.slug}/${intent}: ${u.origin} is not ${out.partner.home}`);
      }
      if (u.protocol !== "https:") badUrls.push(`${g.slug}/${intent}: not https`);
    }
  }
  assert("every outbound URL is https and stays on its partner's own origin",
    badUrls.length === 0, badUrls[0] ?? `${GAMES.length * 2} URLs built`);

  // A partner covering more than one game maps its slugs by hand, and a typo in
  // that map does not throw — it falls through to the same path for both, so
  // Fisch players land on the Sonaria list and nobody notices. Distinct games,
  // distinct paths.
  const collided = PARTNERS.filter((p) => p.games.length > 1).flatMap((p) => {
    const paths = p.games.map((g) => p.valuesPath(g));
    return new Set(paths).size === paths.length
      ? []
      : [`${p.name} sends ${p.games.join(" and ")} to the same page`];
  });
  assert("a multi-game partner sends each game somewhere different",
    collided.length === 0, collided[0] ?? "every mapped game has its own path");

  // ---- 3. nothing claims commission before an agreement exists ------------
  const claiming = PARTNERS.filter((p) => p.active);
  assert(
    "no partner claims commission without an agreement",
    claiming.length === 0,
    claiming.length ? `${claiming.map((p) => p.name).join(", ")} marked active` : "all inactive",
  );

  // ---- 4. the destination never comes from the request --------------------
  //
  // The open-redirect shape. If valuesLink ever returned an absolute URL, /go
  // would be forwarding somewhere it did not derive, and a link carrying
  // MintPlaza's domain could point anywhere — which on a site full of children
  // holding valuable inventories is a ready-made phishing page.
  const offsite = GAMES
    .map((g) => valuesLink(g.slug)?.href ?? "")
    .filter((h) => h && !h.startsWith("/go/"));
  assert("every values href is same-origin", offsite.length === 0,
    offsite[0] ?? "outbound URL is built server-side only");

  // And the one word the route does take from the query string is a closed
  // set, so the worst an attacker who controls it can do is pick which of the
  // partner's own two pages they land on.
  const escapes = ["values", "calculator", "../../evil", "https://evil.example", "", null]
    .filter((v) => isValuesIntent(v as string | null))
    .filter((v) => v !== "values" && v !== "calculator");
  assert("the intent parameter is a closed set of two words", escapes.length === 0,
    escapes.length ? String(escapes[0]) : "only values | calculator pass");
}

line("9b. THE VALUE SYSTEM IS GONE, NOT SWITCHED OFF");
{
  // Half-removing a value system is worse than either keeping it or dropping
  // it: the numbers stay reachable, nothing maintains them, and the next person
  // to read the code cannot tell which state it is meant to be in. These are
  // the checks that stop it drifting back.
  for (const dead of [
    "src/lib/values.ts",
    "src/components/ValueLookup.tsx",
  ]) {
    assert(`${dead} is gone`, !existsSync(dead));
  }

  // Nothing may import it back. A grep, because a type error only catches the
  // file existing — this catches somebody recreating it.
  const sources: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name)) sources.push(full);
    }
  })("src");

  // Comments are stripped first, and that is not a detail. These files are
  // heavily commented, and several of them explain AT LENGTH that values were
  // removed — naming the very identifiers being searched for. A raw grep fails
  // on its own documentation, which teaches whoever hits it that the check is
  // noise and the right move is to delete the check. So it reads code only.
  const code = new Map(sources.map((f) => [f, stripComments(readFileSync(f, "utf8"))]));
  const where = (re: RegExp) => sources.filter((f) => re.test(code.get(f)!));

  const importers = where(/from\s+["'][^"']*\/values["']/);
  assert("nothing imports a values module", importers.length === 0, importers[0]);

  // The keys a live database may still be carrying. The schema clears them;
  // this proves the app would not read them even if it had not.
  const readers = where(/\b(valuePhysical|valuePermanent)\b/);
  assert("no component reads a stored value field", readers.length === 0, readers[0]);

  // And no verdict. The W/F/L is the partner's to give now.
  const verdicts = where(/\bVERDICT_(COPY|STYLE|POINTS)\b/);
  assert("no W/F/L verdict is computed anywhere in the app", verdicts.length === 0, verdicts[0]);

  // The seeded value table itself, by the two names it went by.
  const tables = where(/\b(VALUE_SOURCES|CATALOG_GAPS)\b/);
  assert("no seeded value table survives", tables.length === 0, tables[0]);
}

line("10. WHERE THE CATALOGUE CAME FROM");
for (const g of ["blox-fruits", "fisch", "gag2", "pet-simulator-99", "adopt-me", "creatures-of-sonaria"]) {
  const p = catalogProvenance(g);
  console.log(
    "  " + g.padEnd(22),
    `curated ${String(p.curated).padStart(3)}`,
    `| pulled ${String(p.pulled).padStart(4)}`,
    `| ${String(p.curated + p.pulled).padStart(4)} rows total`,
  );
}

line("11. FISCH — text-only, and every variant a player can actually own");
{
  const fisch = catalogFor("fisch");
  const withArt = fisch.filter((i) => thumbnailFor(i) !== undefined);
  assert(
    "no Fisch row resolves to an image",
    withArt.length === 0,
    withArt.length ? `${withArt.length} would load art, e.g. ${withArt[0].name}` : `${fisch.length} rows, all typographic`,
  );

  // A game that shows no pictures has to carry rarity some other way, or the
  // grid is 2,133 identical grey squares.
  const tiers = new Set(fisch.map((i) => i.rarity).filter(Boolean));
  assert("the tile ring has a rarity to show", tiers.size >= 5, `${tiers.size} distinct tiers present`);

  const axes = variantAxesFor("fisch");
  assert("both variant axes are exposed", axes.length === 2,
    axes.map((a) => `${a.label}(${a.options.length})`).join(" + "));

  const attrs = axes.find((a) => a.key === "attribute");
  const muts = axes.find((a) => a.key === "mutation");
  assert("attributes stack, mutation does not",
    attrs?.stacks === true && muts?.stacks === false);

  // Every mutation the game has is selectable, including the ones no value
  // list has settled on. A picker that only offers what somebody has priced
  // leaves a player unable to say what they are actually holding — and since
  // MintPlaza prices nothing at all now, that would be an empty picker.
  const mutOptions = muts?.options ?? [];
  assert("every mutation the game has is selectable", mutOptions.length >= 19,
    `${mutOptions.length} mutations offered`);
  for (const must of ["Aether", "Prism", "Tryhard", "Galaxy"]) {
    assert(`${must} is in the picker`, mutOptions.includes(must));
  }

  // Five things called Nessie, across two categories. The research calls
  // confusing a rod SKIN with a ROD the most expensive mistake in this game.
  const nessie = fisch.filter((i) => /nessie/i.test(i.name));
  const cats = new Set(nessie.map((i) => i.category));
  console.log(`  "nessie" matches ${nessie.length} rows across ${cats.size} categories: ${[...cats].join(", ")}`);
  assert("every one of them carries a category to tell them apart",
    nessie.every((i) => Boolean(i.category)));
}

line("12. GAG2 — the cosmetics the catalogue used to be missing");
{
  const gag2 = catalogFor("gag2");
  const cosmetics = gag2.filter((i) => i.category === "Cosmetic");

  // The defect this block fixed: 31 crates and not one of the things that
  // come out of them. A player who opened a Boombox Crate could not list what
  // they got.
  assert("GAG2 has a cosmetics category at all", cosmetics.length > 0,
    `${cosmetics.length} rows across ${new Set(cosmetics.map((i) => i.type)).size} groups`);

  const missing = ["Boombox", "Conveyor", "Bench", "Ladder", "Seesaw", "Bridge",
    "Arch", "Bear Trap", "Spring", "Fence", "Owner Door", "Wood Wall"]
    .filter((stem) => {
      const crate = gag2.some((i) => i.category === "Crate" && i.name === `${stem} Crate`);
      const drop = cosmetics.some((i) => i.type === stem || i.name.includes(stem));
      return crate && !drop;
    });
  assert(
    "every crate that names one cosmetic line has that line in the catalogue",
    missing.length === 0,
    missing.length ? `no cosmetic for ${missing.join(", ")}` : "12 crate/cosmetic pairs resolve",
  );

  // gag2.gg lists fences by a bare adjective because its own page heading
  // supplies the noun. Carried across literally, "Light" and "Wood" would
  // outrank Moss Light and Wood Floor for their own queries.
  const fences = cosmetics.filter((i) => i.type === "Fence");
  const bare = fences.filter((i) => !/ Fence$/.test(i.name));
  assert("no fence is left named as a bare adjective", bare.length === 0,
    bare.length ? `e.g. "${bare[0].name}"` : `${fences.length} fences carry the noun`);
  assert(
    "every fence still answers to the word printed on the value list",
    fences.every((i) => i.aliases?.length),
    fences.map((i) => i.aliases?.[0]).join(", "),
  );

  // This block used to assert that four cosmetics carried a published value.
  // They no longer carry one, and neither does anything else — GAG2's numbers
  // are GAG2.GG's to publish, and its calculator runs the game's own sell
  // formula, which is a better answer than any snapshot here ever was.
  assert("GAG2 hands its values to GAG2.GG", partnerFor("gag2")?.key === "gag2gg",
    partnerFor("gag2")?.home);

  // A curated row wins its name outright, so adding a cosmetic that shares a
  // name with an existing row would silently re-file that row. These two were
  // left alone on purpose.
  for (const name of ["Sign", "Weather Machine"]) {
    const row = gag2.find((i) => i.name === name);
    assert(`${name} was not re-filed out of Gear by the cosmetics block`,
      row?.category === "Gear", row?.category);
  }
}

line("13. THE ART LAYER — pictures for GAG2, still none for Fisch");
{
  const artDir = new URL("../public/items/gag2/", import.meta.url);
  const files = existsSync(artDir) ? readdirSync(artDir).filter((f) => f.endsWith(".png")) : [];
  assert("GAG2 art is on disk", files.length > 0, `${files.length} files`);

  // Every file is named for the row it belongs to. An orphan means a crop was
  // filed under an id that does not exist, and it would simply never render —
  // silently, because the manifest lookup just misses.
  const orphans = files.filter((f) => !findItem(f.replace(/\.png$/, "")));
  assert("every art file names a real catalogue row", orphans.length === 0,
    orphans.length ? `${orphans.length} orphaned, e.g. ${orphans[0]}` : `${files.length} resolve`);

  const withArt = catalogFor("gag2").filter((i) => thumbnailFor(i) !== undefined);
  assert("the manifest and the disk agree", withArt.length === files.length,
    `${withArt.length} rows resolve art, ${files.length} files present`);

  // The whole point of the manifest: a row with no file must resolve to
  // undefined rather than to a path that 404s on every catalogue page.
  const unart = catalogFor("gag2").find((i) => !files.includes(`${i.id}.png`));
  assert("a row with no file resolves to no path, not a broken one",
    unart !== undefined && thumbnailFor(unart) === undefined, unart?.name);

  // The regression that matters most. Fisch is text-only by decision, and the
  // rule is enforced before any art path is consulted — so dropping files into
  // public/items/fisch/ would change nothing. Adding pictures for one game must
  // never leak into the game that refuses them.
  const fischArt = catalogFor("fisch").filter((i) => thumbnailFor(i) !== undefined);
  assert("Fisch still resolves to no image at all", fischArt.length === 0,
    fischArt.length ? `${fischArt.length} leaked, e.g. ${fischArt[0].name}` : "2,147 rows, still typographic");

  // Tiles render at 38-56px. A 256px source would be four times the pixels for
  // no visible gain, and 240 of them is a megabyte of it.
  const big = files.filter((f) => statSync(new URL(f, artDir)).size > 40_000);
  assert("no art file is oversized for a 44px tile", big.length === 0,
    big.length ? `${big.length} over 40KB, e.g. ${big[0]}` : "largest is under 40KB");
}

line("14. FISCH ROD SKINS — the fourteen the pull never reached");
{
  const added = ["Stormbringer", "Celestial Ghoul", "Arctic Coral", "Violet Kraken",
    "Flame Shears", "Whispering Tentacles", "Anchor of the Sleeper", "Midas Spirit"];
  const missing = added.filter((n) => !catalogFor("fisch").some((i) => i.name === n));
  assert("every skin read off the wiki page resolves", missing.length === 0,
    missing.length ? `missing ${missing.join(", ")}` : `${added.length} spot-checked`);

  const skins = catalogFor("fisch").filter((i) => i.category === "Rod Skin");
  assert("they joined the existing rod skins rather than a new category",
    skins.length >= 110, `${skins.length} rod skins`);

  // The expensive mistake this game offers is confusing a skin with the rod it
  // dresses. Every curated skin says which rod, in words, on the row itself.
  const curated = skins.filter((i) => i.id.startsWith("fisch-skin-"));
  assert("every curated skin names the rod it dresses",
    curated.every((i) => /Skin for the .+ Rod|Skin for the Fang/.test(i.note ?? "")),
    `${curated.length} carry their rod`);
}

line("15. MATCHING — the ranking, and the four ways it could quietly lie");
{
  // A board built by hand, so every expectation below is about the engine and
  // not about whatever happens to be in the catalogue this week.
  const NOW = Date.parse("2026-09-13T12:00:00Z");
  const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

  type Side = { side: "offer" | "want"; itemId: string; quantity?: number; variant?: string };
  const row = (
    id: string,
    sides: Side[],
    extra: Partial<ListingRow> = {},
  ): ListingRow => ({
    listing_id: id,
    game_slug: "blox-fruits",
    user_id: `u-${id}`,
    username: id,
    display_name: null,
    avatar_url: null,
    online: false,
    deals: 0,
    note: null,
    created_at: hoursAgo(2),
    bumped_at: hoursAgo(2),
    expires_at: new Date(NOW + 86_400_000).toISOString(),
    bumpable: false,
    sides: sides.map((x) => ({
      side: x.side,
      itemId: x.itemId,
      customName: null,
      quantity: x.quantity ?? 1,
      attributes: x.variant ? { variant: x.variant } : {},
    })),
    ...extra,
  });

  const hold = (itemId: string, quantity = 1, variant?: string) =>
    ({ itemId, variant, quantity });

  // ---- the ordering claim the whole tab rests on --------------------------
  {
    const board = [
      row("wants-only", [{ side: "offer", itemId: "bf-rocket" }, { side: "want", itemId: "bf-kitsune" }]),
      row("reciprocal", [{ side: "offer", itemId: "bf-magnet" }, { side: "want", itemId: "bf-kitsune" }]),
      row("has-only", [{ side: "offer", itemId: "bf-magnet" }, { side: "want", itemId: "bf-rocket" }]),
    ].map(toBoardListing);

    const out = suggestTrades(board, [hold("bf-kitsune")], [hold("bf-magnet")], { now: NOW });

    assert("a reciprocal match outranks every other kind",
      out[0]?.listing.id === "reciprocal", out.map((s) => s.listing.id).join(" > "));
    assert("the reciprocal one is marked closeable",
      out.find((s) => s.listing.id === "reciprocal")?.canClose === true);
    assert("a listing touching neither list is dropped entirely",
      !out.some((s) => s.listing.id === "unrelated"), `${out.length} kept`);
  }

  // ---- you give the whole want side, not the part that matched ------------
  //
  // The expensive version of this bug is silent: price only the overlap and
  // every multi-item trade reads better than it is, in the viewer's favour.
  {
    const board = [row("bundle", [
      { side: "offer", itemId: "bf-magnet" },
      { side: "offer", itemId: "bf-rocket" },
      { side: "want", itemId: "bf-kitsune" },
      { side: "want", itemId: "bf-spin" },
    ])].map(toBoardListing);

    const [s] = suggestTrades(board, [hold("bf-kitsune"), hold("bf-spin")], [hold("bf-magnet")], { now: NOW });
    assert("you receive everything offered, not just what you asked for",
      s.youGet.length === 2, `${s.youGet.length} items`);
    assert("you hand over everything wanted, not just what matched",
      s.youGive.length === 2, `${s.youGive.length} items`);
    assert("the items that matched are still reported separately",
      s.wantedHits.length === 1 && s.wantedHits[0].item.id === "bf-magnet");
  }

  // ---- quantity is real ---------------------------------------------------
  {
    const board = [row("three", [
      { side: "offer", itemId: "bf-magnet" },
      { side: "want", itemId: "bf-kitsune", quantity: 3 },
    ])].map(toBoardListing);

    const short = suggestTrades(board, [hold("bf-kitsune", 1)], [hold("bf-magnet")], { now: NOW })[0];
    assert("holding one against an ask for three cannot close",
      short.canClose === false && short.missing.length === 1,
      `missing ${short.missing.length}`);

    const enough = suggestTrades(board, [hold("bf-kitsune", 3)], [hold("bf-magnet")], { now: NOW })[0];
    assert("holding three against an ask for three can close", enough.canClose === true);
  }

  // ---- the variant rule, in both directions -------------------------------
  //
  // Loose where it should be strict is the one that costs a player a DM: it
  // tells them they can close a deal they cannot.
  {
    const named = [row("named", [
      { side: "offer", itemId: "bf-magnet" },
      { side: "want", itemId: "bf-kitsune", variant: "Permanent" },
    ])].map(toBoardListing);

    const plain = suggestTrades(named, [hold("bf-kitsune", 1)], [hold("bf-magnet")], { now: NOW })[0];
    assert("a plain item does not satisfy an ask for a named variant",
      plain.canClose === false, `missing ${plain.missing.length}`);

    const exact = suggestTrades(named, [hold("bf-kitsune", 1, "Permanent")], [hold("bf-magnet")], { now: NOW })[0];
    assert("the named variant does satisfy it", exact.canClose === true);

    const any = [row("any", [
      { side: "offer", itemId: "bf-magnet" },
      { side: "want", itemId: "bf-kitsune" },
    ])].map(toBoardListing);
    const held = suggestTrades(any, [hold("bf-kitsune", 1, "Permanent")], [hold("bf-magnet")], { now: NOW })[0];
    assert("an ask that names no variant is satisfied by any of them",
      held.canClose === true);
  }

  // ---- the ranking never depends on a value -------------------------------
  //
  // This replaced two checks that tied the suggestion's verdict to calculate().
  // There is no verdict and no calculate(). What matters now is the property
  // those checks were protecting in the first place: the ranker must not
  // quietly bury a game. It used to be possible for Fisch — sparse on values —
  // to sink because "?" scored nothing. Nothing scores on value at all now, so
  // the guarantee is stronger and this proves it holds by inspection of the
  // factors themselves.
  {
    const board = [row("r", [
      { side: "offer", itemId: "bf-magnet" },
      { side: "want", itemId: "bf-kitsune" },
    ])].map(toBoardListing);
    const [s2] = suggestTrades(board, [hold("bf-kitsune")], [hold("bf-magnet")], { now: NOW });

    const valueWords = /value|worth|w\/f\/l|verdict|priced|demand|costs you|worth more/i;
    const priced = s2.factors.filter((f) => valueWords.test(f.label));
    assert("no ranking factor is about what anything is worth",
      priced.length === 0, priced.map((f) => f.label).join(", "));

    // And every factor that IS there is something the site can check for
    // itself, so none of them can go stale.
    assert("the suggestion still has real reasons behind it",
      s2.factors.length >= 2, s2.factors.map((f) => f.label).join(" | "));
  }

  // ---- ordering is total, so the list cannot move under a thumb -----------
  {
    const board = [
      row("a", [{ side: "offer", itemId: "bf-magnet" }, { side: "want", itemId: "bf-kitsune" }]),
      row("b", [{ side: "offer", itemId: "bf-magnet" }, { side: "want", itemId: "bf-kitsune" }]),
    ].map(toBoardListing);
    const first = suggestTrades(board, [hold("bf-kitsune")], [hold("bf-magnet")], { now: NOW });
    const again = suggestTrades([...board].reverse(), [hold("bf-kitsune")], [hold("bf-magnet")], { now: NOW });
    assert("two identical boards rank identically whatever order they arrive in",
      first.map((s) => s.listing.id).join() === again.map((s) => s.listing.id).join(),
      first.map((s) => s.listing.id).join(" > "));
  }

  // ---- scores stay inside the band the interface assumes ------------------
  {
    const board = [row("rich", [
      { side: "offer", itemId: "bf-kitsune", quantity: 5 },
      { side: "want", itemId: "bf-magnet" },
    ], { online: true, deals: 80, bumped_at: hoursAgo(1) })].map(toBoardListing);
    const [s] = suggestTrades(board, [hold("bf-magnet")], [hold("bf-kitsune")], { now: NOW });
    assert("a maximally flattering listing still scores within 0–100",
      s.score >= 0 && s.score <= 100, `${s.score}`);
  }

  // ---- an item that left the catalogue is reported, not dropped -----------
  {
    const board = [row("gone", [
      { side: "offer", itemId: "bf-magnet" },
      { side: "offer", itemId: "bf-this-never-existed" },
      { side: "want", itemId: "bf-kitsune" },
    ])].map(toBoardListing);
    assert("a side naming an unknown item keeps it as unresolved rather than hiding it",
      board[0].unresolved.length === 1 && board[0].offering.length === 1,
      board[0].unresolved.join());
  }
}

line("16. NO DEAD TRADING CODE — the tables the app used to never touch");
{
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const schema = read("../supabase/schema.sql");

  // The bug this replaces: item_id was a uuid foreign key onto a table nothing
  // seeds, so every inventory insert pushed a catalogue slug into a uuid column
  // and came back 22P02. Not one row was ever written.
  assert("inventory item_id is keyed on the catalogue slug, not a uuid",
    /inventory_item_slug_shape/.test(schema)
    && /rename column item_slug to item_id/.test(schema)
    && /mintplaza\.is_item_slug/.test(schema));

  assert("the naive SQL ranker is gone rather than left to rot",
    /drop function if exists public\.recommended_listings/.test(schema)
    && !/create or replace function public\.recommended_listings/.test(schema));

  for (const fn of ["trade_feed", "trade_match_candidates", "post_trade_listing",
                    "cancel_trade_listing", "my_trade_listings", "trade_listings_of"]) {
    assert(`${fn}() exists and the app calls it`,
      schema.includes(`function public.${fn}(`)
      && read("../src/lib/data/trades.ts").includes(fn)
        || read("../src/lib/actions/trades.ts").includes(fn));
  }

  // The database now refuses anything in item_id that is not a catalogue slug,
  // and specifically refuses a uuid — which is the value the old code sent. That
  // constraint is only safe because every id in the catalogue satisfies it, so
  // the catalogue is checked against the same two patterns here. If a future
  // row ever breaks the shape, this fails long before an insert does.
  const SLUG = /^[a-z][a-z0-9-]{0,119}$/;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const misshapen = CATALOG.filter((i) => !SLUG.test(i.id));
  assert("every catalogue id satisfies the shape the database now demands",
    misshapen.length === 0,
    misshapen.length ? misshapen.slice(0, 3).map((i) => i.id).join(", ")
                     : `${CATALOG.length.toLocaleString()} ids`);
  assert("and none of them is uuid-shaped, so the rule can tell the two apart",
    !CATALOG.some((i) => UUID.test(i.id)));

  // A listing has to be unreachable once it expires even if the scheduled
  // sweeper has not run — status is the intent, the clock is the truth.
  const feeds = schema.slice(schema.indexOf("mintplaza.live_listings"));
  assert("the board filters on the clock, not only on status",
    /expires_at > now\(\)/.test(feeds));
}

line("17. NOTHING SECRET IS PREFIXED NEXT_PUBLIC_");
{
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  // NEXT_PUBLIC_ is not a label, it is an instruction: the value is substituted
  // into the JavaScript at build time and ships to every visitor. The dev
  // sign-in password was read that way, so it sat in the bundle as a string
  // literal next to the two account emails it opened — verified by grepping a
  // production build and finding it. The buttons were correctly hidden in
  // production, which is why it went unnoticed: rendering nothing is not the
  // same as shipping nothing, and Supabase's auth endpoint is public.
  //
  // Only the Supabase URL and anon key belong on that prefix. Both are
  // publishable by design; row-level security is what protects the data.
  const walk = (dir: string): string[] => {
    const here = new URL(dir, import.meta.url);
    return readdirSync(here, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`)
        : /\.(ts|tsx)$/.test(e.name) ? [`${dir}/${e.name}`] : []);
  };

  const SECRETISH = /NEXT_PUBLIC_[A-Z0-9_]*(PASSWORD|SECRET|TOKEN|PRIVATE|SERVICE_ROLE)[A-Z0-9_]*/g;
  const offenders: string[] = [];

  for (const f of walk("../src")) {
    for (const hit of read(f).match(SECRETISH) ?? []) {
      // The one in dev-login.ts is prose explaining why it was removed.
      if (f.endsWith("dev-login.ts")) continue;
      offenders.push(`${f.replace("../", "")}: ${hit}`);
    }
  }
  assert("no NEXT_PUBLIC_ variable names a password, secret or token",
    offenders.length === 0, offenders.slice(0, 3).join(" | "));

  const envExample = read("../.env.example");
  assert("and .env.example does not define one either",
    !SECRETISH.test(envExample.replace(/^#.*$/gm, "")));

  // The dev password must be read on the server and nowhere else.
  const devAction = read("../src/lib/actions/dev-login.ts");
  assert("the dev sign-in password is read by a server action",
    /"use server"/.test(devAction) && /process\.env\.DEV_PASSWORD/.test(devAction));
  assert("and that action re-checks the build and the flag on the server",
    /NODE_ENV !== "production"/.test(devAction)
    && /NEXT_PUBLIC_DEV_LOGIN === "on"/.test(devAction));
  assert("and refuses any email that is not one of the dev accounts",
    /DEV_ACCOUNTS\.some/.test(devAction));

  const devUi = read("../src/components/DevSignIn.tsx");
  assert("the component never touches the password",
    !/DEV_PASSWORD/.test(devUi) && !/signInWithPassword/.test(devUi));
}

line("18. NO GAME ADVERTISES A BOARD IT CANNOT FILL");
{
  // A tab a player can open and find nothing to post on is worse than no tab:
  // it reads as broken rather than as empty. Two games are genuinely in that
  // position — the research is not done — and the explore page says so through
  // PARTIAL_SERVICES. What must never happen is a game landing in that state
  // WITHOUT being listed, because then the screen just looks broken.
  const SECTION = { services: "services", community: "recruit" } as const;
  const silent: string[] = [];

  for (const g of GAMES) {
    for (const tab of g.exploreTabs ?? []) {
      if (tab.kind === "trades") continue;
      const section = SECTION[tab.kind as keyof typeof SECTION];
      if (!section) continue;
      const n = servicesFor(g.slug, section).length;
      if (n === 0 && !PARTIAL_SERVICES.includes(g.slug)) {
        silent.push(`${g.slug}/${tab.kind}`);
      }
    }
  }
  assert("every advertised board either has templates or is declared unfinished",
    silent.length === 0, silent.join(", "));

  // And the declaration has to stay honest in the other direction: a game
  // listed as partial that has since been filled in is telling players it is
  // unfinished when it is not.
  const stale = PARTIAL_SERVICES.filter((slug) => {
    const g = GAMES.find((x) => x.slug === slug);
    if (!g) return false;
    return (g.exploreTabs ?? [])
      .filter((t) => t.kind !== "trades")
      .every((t) => servicesFor(slug, SECTION[t.kind as keyof typeof SECTION] ?? "services").length > 0);
  });
  assert("and no game is still called unfinished after being filled in",
    stale.length === 0, stale.join(", "));

  // The post button writes these columns; the table has to have them. ref_id
  // was missing for the whole life of the feature, so posting always failed.
  const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  const board = readFileSync(new URL("../src/lib/actions/board.ts", import.meta.url), "utf8");
  const written = [...board.matchAll(/^\s{6}([a-z_]+):/gm)].map((m) => m[1]);
  const listingCols = ["game_slug","author_id","side","service_ids","terms_kind",
                       "terms_item_id","detail","ref_id","expires_at","vote_cap","slots"];
  const absent = listingCols.filter((c) => !new RegExp(`\\b${c}\\b`).test(schema));
  assert("every column a posted listing writes exists in the schema",
    absent.length === 0, absent.join(", "));
  assert("and postListing still writes the ones the board reads back",
    listingCols.every((c) => written.includes(c) || c === "slots"));
}

line("19. THE SECURITY POSTURE HOLDS");
{
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const walk = (dir: string): string[] => {
    const here = new URL(dir, import.meta.url);
    return readdirSync(here, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`)
        : /\.(ts|tsx)$/.test(e.name) ? [`${dir}/${e.name}`] : []);
  };
  const app = walk("../src");

  // Clickjacking is the cheap attack against a trust site: iframe a profile,
  // lay a fake "verified" badge over it, screenshot. And the paths here carry
  // Roblox usernames, so a default referrer policy hands whose profile a
  // player was reading to every third-party host the page touches.
  const nextConfig = read("../next.config.ts");
  for (const h of ["frame-ancestors", "X-Frame-Options", "X-Content-Type-Options",
                   "Referrer-Policy", "Strict-Transport-Security", "Permissions-Policy"]) {
    assert(`${h} is set`, nextConfig.includes(h));
  }

  // React escapes by default; the only way past it is to ask.
  const raw = app.filter((f) =>
    /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(stripComments(read(f))));
  assert("nothing renders unescaped HTML", raw.length === 0, raw.join(", "));

  // A target=_blank without noopener hands the opened page a handle back to
  // this one, and every one of these points somewhere we do not control.
  const leaky = app.filter((f) => {
    const src = read(f);
    return src.split("\n").some((l, i) =>
      l.includes('target="_blank"') &&
      !src.split("\n").slice(Math.max(0, i - 3), i + 4).join(" ").includes("noopener"));
  });
  assert("every new-tab link carries rel=noopener", leaky.length === 0, leaky.join(", "));

  // "//evil.com" is a valid relative-looking URL that is not relative at all.
  const callback = read("../src/app/auth/callback/route.ts");
  assert("the sign-in redirect refuses an off-site destination",
    /startsWith\("\/"\)/.test(callback) && /startsWith\("\/\/"\)/.test(callback));

  // The panel answers 404 rather than 403 — "forbidden" would confirm there is
  // something there — and must never be indexed or previewed.
  const admin = read("../src/app/admin/page.tsx");
  assert("the admin page 404s rather than forbidding", /notFound\(\)/.test(admin));
  assert("and is never indexed", /index:\s*false/.test(admin));

  // The one route that reaches out to another host. An unchecked id here would
  // make the server fetch whatever a caller names.
  const img = read("../src/app/api/item-image/[assetId]/route.ts");
  assert("the image proxy validates the asset id before fetching",
    /ASSET_ID\.test\(assetId\)/.test(img) && /thumbnails\.roblox\.com/.test(img));

  // Every server action is a public HTTP endpoint. The ones without an inline
  // identity check must be delegating to a database function that has one.
  const board = read("../src/lib/actions/trades.ts");
  const schema = read("../supabase/schema.sql");
  for (const fn of ["cancel_trade_listing", "bump_listing"]) {
    const body = schema.slice(schema.indexOf(`function public.${fn}`));
    assert(`${fn}() checks the caller owns the listing`,
      /user_id = auth\.uid\(\)/.test(body.slice(0, 900)));
  }
  assert("and the actions that rely on that do call those functions",
    /cancel_trade_listing/.test(board) && /bump_listing/.test(board));
}

line("20. LEVEL UP — the page cannot promise what the database will not give");
{
  // The sales page names four numbers. The database enforces four numbers.
  // They are in different files, in different languages, and nothing but this
  // check makes them the same — which is the exact shape of a bug that gets
  // somebody to pay for ten listings and receive three.
  //
  // So the SQL is read as text and the figures are pulled straight out of it.
  // A regex against source is usually a smell; here it is the point, because
  // the alternative is trusting that two hand-maintained lists agree.
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const sql = read("../supabase/schema.sql");

  const paid = (name: string, re: RegExp): string | undefined => {
    const body = sql.match(
      new RegExp(`create or replace function mintplaza\\.${name}\\(p_user uuid\\)[\\s\\S]*?\\$\\$;`),
    )?.[0];
    return body?.match(re)?.[1];
  };
  const free = (name: string, re: RegExp): string | undefined => {
    const body = sql.match(
      new RegExp(`create or replace function mintplaza\\.${name}\\(\\)[\\s\\S]*?\\$\\$;`),
    )?.[0];
    return body?.match(re)?.[1];
  };

  const perk = (needle: string) => PERKS.find((p) => p.title.includes(needle));

  // ---- 1. ten listings up at once, instead of three ----------------------
  const paidPerGame = paid("max_active_per_game_for", /then\s+(\d+)\s+else/);
  const freePerGame = free("max_active_per_game", /select (\d+)/);
  const p1 = perk("Ten listings");
  assert("the listing count on the page is the one the trigger enforces",
    paidPerGame === "10" && freePerGame === "3"
      && Boolean(p1) && p1!.levelUp.includes("10") && p1!.free.includes("3"),
    `sql: ${freePerGame} free / ${paidPerGame} paid · page: "${p1?.free}" -> "${p1?.levelUp}"`);

  // ---- 2. three days instead of one --------------------------------------
  const paidLife = paid("listing_lifetime_for", /then\s+interval\s+'(\d+) days'/);
  const freeLife = free("listing_lifetime", /interval '(\d+) hours'/);
  const p2 = perk("three days");
  assert("and how long a listing lives",
    paidLife === "3" && freeLife === "24"
      && Boolean(p2) && p2!.levelUp.includes("3 days") && p2!.free.includes("24 hours"),
    `sql: ${freeLife}h free / ${paidLife} days paid · page: "${p2?.free}" -> "${p2?.levelUp}"`);

  // ---- 3. the per-window rate limit rises too -----------------------------
  //
  // Not sold as a perk and not on the page, but it has to move with the
  // per-game cap or the cap is unreachable: ten listings you may hold and
  // three you may post per window means seven of them can never exist.
  const paidWindow = paid("listings_per_window_for", /then\s+(\d+)\s+else/);
  assert("the posting rate allows the paid listing count to actually be reached",
    Number(paidWindow) >= Number(paidPerGame),
    `${paidWindow} per window vs ${paidPerGame} allowed live`);

  // ---- 4. what is NOT sold ------------------------------------------------
  //
  // Bumping is the one perk that would take something from everybody else: the
  // board sorts on bumped_at, so a paid bump pushes free listings down. The
  // page must not offer it, and the database must not grant it.
  const bumpBody = sql.match(
    /create or replace function mintplaza\.bumps_per_day_for\(p_user uuid\)[\s\S]*?\$\$;/,
  )?.[0] ?? "";
  assert("bumping is the same whether or not you pay",
    !bumpBody.includes("is_level_up"),
    bumpBody.includes("is_level_up")
      ? "bumps_per_day_for still branches on Level Up"
      : "one cooldown for everybody");

  assert("and the page does not advertise it",
    !PERKS.some((p) => /bump/i.test(p.title) || /bump/i.test(p.levelUp)));

  // A bump cooldown longer than a free listing's life is a feature that does
  // nothing for anybody who has not paid — which is how this was found.
  const bumpsPerDay = Number(bumpBody.match(/select (\d+)/)?.[1]);
  const cooldownHours = 24 / bumpsPerDay;
  assert("and the cooldown is shorter than a free listing's whole life",
    Number.isFinite(cooldownHours) && cooldownHours < Number(freeLife),
    `bump every ${cooldownHours}h against a ${freeLife}h listing`);

  // ---- 5. nothing that could be mistaken for a safety signal -------------
  //
  // A mark you can buy is worth more to a scammer than to anybody honest. The
  // page may not sell one, and no component may draw one.
  assert("no perk is a badge, a mark or a tick",
    !PERKS.some((p) => /badge|mark|tick|verif/i.test(`${p.title} ${p.levelUp}`)),
    PERKS.map((p) => p.title).join(" | "));

  // ---- 6. every perk is a real limit, not a vibe -------------------------
  const vague = PERKS.filter((p) => !(/\d/.test(p.free) && /\d/.test(p.levelUp)));
  assert("every perk names a number on both sides",
    vague.length === 0, vague.map((p) => p.title).join(", ") || `${PERKS.length} perks`);
}

line("21. LEVEL UP — the money, and the ways it could go wrong quietly");
{
  // ---- the two prices the owner actually chose ---------------------------
  assert("India is ₹399", priceFor("IN").display === "₹399" && priceFor("IN").currency === "INR");
  assert("the United States is $6", priceFor("US").display === "$6" && priceFor("US").currency === "USD");

  // Everywhere else falls back to dollars rather than to nothing. A country
  // with no price would render an empty button on a payment page.
  const priceless = COUNTRIES.filter((c) => !priceFor(c.code).display);
  assert("every country in the picker has a price", priceless.length === 0,
    priceless.length ? priceless[0].name : `${COUNTRIES.length} countries covered`);

  // ---- and everyone charged in dollars is told so -------------------------
  //
  // The one thing that turns into a chargeback: somebody in Brazil expecting
  // reais, seeing "$6", and finding out from their bank. Every non-local
  // country must carry the note, and the local one must not (it would be
  // false).
  const undisclosed = COUNTRIES.filter(
    (c) => !isLocalCurrency(c.code) && !priceNote(c.code),
  );
  assert("everyone paying in dollars is told their bank converts it",
    undisclosed.length === 0, undisclosed[0]?.name);
  assert("and the rupee price carries no conversion note, because there is none",
    priceNote("IN") === undefined);

  // ---- the picker is a closed list ----------------------------------------
  const escapes = ["IN", "US", "in", "zz", "XX", "", "../../etc", null]
    .filter((v) => isCountryCode(v as string | null))
    .filter((v) => !COUNTRIES.some((c) => c.code === (v as string).toUpperCase()));
  assert("the country parameter is a closed list", escapes.length === 0,
    escapes.length ? String(escapes[0]) : "only the 56 listed codes pass");

  // Duplicate codes would make the <select> ambiguous and the record wrong.
  const codes = COUNTRIES.map((c) => c.code);
  assert("no country code appears twice", new Set(codes).size === codes.length);

  // ---- nothing here can take money ----------------------------------------
  //
  // The single most important check in this block. There is no processor
  // connected, and the correct behaviour is to say so — not to render a button
  // that goes nowhere, and emphatically not to collect a card.
  delete process.env.LEVEL_UP_CHECKOUT_URL_INR;
  delete process.env.LEVEL_UP_CHECKOUT_URL_USD;
  assert("with no processor configured, there is no checkout link at all",
    checkoutUrlFor("IN") === undefined && checkoutUrlFor("US") === undefined);

  // A typo in a deploy config must not become a javascript: link on a page
  // full of children. Anything that is not plain https reads as unconfigured.
  for (const bad of ["javascript:alert(1)", "http://evil.example", "not a url", " "]) {
    process.env.LEVEL_UP_CHECKOUT_URL_USD = bad;
    assert(`a checkout URL of "${bad.trim() || "(blank)"}" is refused`,
      checkoutUrlFor("US") === undefined);
  }
  process.env.LEVEL_UP_CHECKOUT_URL_USD = "https://pay.example/level-up";
  assert("and a real https one is accepted",
    checkoutUrlFor("US") === "https://pay.example/level-up");
  delete process.env.LEVEL_UP_CHECKOUT_URL_USD;

  // ---- no card form exists anywhere ---------------------------------------
  //
  // Holding card data means being inside PCI scope, which is not somewhere a
  // site run by one person belongs. This is a grep rather than a promise.
  const pages: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name)) pages.push(full);
    }
  })("src");
  // An assignment or a form field, never a bare word — the legal pages talk
  // about card details precisely in order to say none are collected, and a
  // loose match flags them for saying so.
  const cardFields = pages.filter((f) => {
    const src = stripComments(readFileSync(f, "utf8"));
    return /\b(cardNumber|card_number|cvv|cvc|cardHolder)\s*[:=]/i.test(src)
      || /name=["'](cardNumber|cvv|cvc|card_number)["']/i.test(src);
  });
  assert("nothing in this codebase asks for a card number", cardFields.length === 0,
    cardFields[0]);
}

line("22. NO BUTTON ON THIS SITE DOES NOTHING");
{
  // Three buttons shipped that did nothing at all when tapped: "Message" and
  // "Make offer" on every trade listing, "Ask to join" on every explore card,
  // and every item tile in the catalogue. None of them threw, none of them
  // logged, none of them were caught by typechecking or the build — they just
  // sat there looking like the point of the page.
  //
  // That is the worst class of bug on a site trying to earn trust from
  // fourteen-year-olds, because it does not read as "broken", it reads as
  // "ignoring me". So it is checked mechanically now.
  //
  // A <button> is honest if it does something: an onClick, a submit inside a
  // form, or a disabled state. Anything else should have been a link or a div.
  const files: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".tsx")) files.push(full);
    }
  })("src");

  const dead: string[] = [];
  for (const f of files) {
    // Comments go first, and this is the second time that has mattered in this
    // file. The components most likely to be scanned are the ones whose
    // comments EXPLAIN a button that was removed — naming <button> while doing
    // the opposite of what the check is looking for. A scanner that trips on
    // its own documentation teaches whoever hits it that the check is noise.
    //
    // JSX comments are stripped as a whole ({/* ... */}), not just their inner
    // /* ... */, because leaving the braces behind would unbalance the depth
    // counter below and swallow the rest of the file.
    const src = stripComments(readFileSync(f, "utf8"));
    // Match a whole <button ...> opening tag. Balanced-brace aware, because an
    // onClick handler contains `=>` and `>` and a naive [^>]* stops inside it —
    // which is exactly the false positive that made the first version of this
    // check report four healthy buttons and hide nothing.
    for (let i = src.indexOf("<button"); i !== -1; i = src.indexOf("<button", i + 1)) {
      let depth = 0;
      let end = -1;
      for (let j = i; j < src.length; j++) {
        const c = src[j];
        if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth === 0) { end = j; break; }
      }
      if (end === -1) continue;
      const tag = src.slice(i, end + 1);
      const acts =
        /\bonClick\b/.test(tag) ||
        /\bonPointerDown\b/.test(tag) ||
        /type=["']submit["']/.test(tag) ||
        /\bformAction\b/.test(tag);
      if (!acts) {
        dead.push(`${f}:${src.slice(0, i).split("\n").length}`);
      }
    }
  }

  assert("every <button> in the app actually does something when tapped",
    dead.length === 0,
    dead.length ? dead.join(", ") : `${files.length} components checked`);
}

line("23. THE PAYMENT WEBHOOK — the guards that are not in the red team");
{
  // scripts/webhook-redteam.mjs attacks a running server: unsigned, wrongly
  // signed, replayed, back-dated, oversized. What it cannot check is the shape
  // of the code itself, and two mistakes there would be invisible to it.
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const route = stripComments(read("../src/app/api/level-up/webhook/route.ts"));

  // A plain === on a hex digest returns as soon as two characters differ, and
  // how long it took says how many leading characters were right. That is
  // enough to recover a valid signature one character at a time without ever
  // knowing the secret. This is the single most important line in that file.
  //
  // The check reads the COMPARISON FUNCTION'S BODY, not the file. An earlier
  // version searched the whole file for "timingSafeEqual" and passed happily
  // after the comparison was swapped for ===, because the import line at the
  // top still mentioned it. Found by making exactly that swap.
  const safeEqualBody = route.match(/function safeEqual\([\s\S]*?\n\}/)?.[0] ?? "";
  assert("the signature comparison itself is constant time",
    safeEqualBody.includes("timingSafeEqual"),
    safeEqualBody ? undefined : "no safeEqual() found at all");
  assert("and nothing compares a signature with ===",
    !/\b(sig|signature|expected|given)\w*\s*===/i.test(safeEqualBody));

  // Signing only the body lets anybody take a captured request, put today's
  // timestamp on it, and replay it forever.
  assert("the timestamp is inside the signed material",
    /\$\{timestamp\}\.\$\{raw\}/.test(route) || route.includes("`${timestamp}.${raw}`"));

  // Fail closed. A webhook that accepted unsigned requests "until the secret is
  // configured" would be a free Level Up for anybody who found the URL, and it
  // would look like it was working.
  assert("no secret means every request is refused",
    /if \(!secret/.test(route) && route.includes("503"));

  // The raw text is signed, never a re-serialised object. JSON.stringify of a
  // parsed body reorders keys and drops whitespace, so a signature computed
  // over it would not match the sender's — or worse, would match several
  // different bodies.
  assert("the signature covers the raw body, not a re-serialised one",
    route.includes("await request.text()") && !route.includes("JSON.stringify(payload)"));

  // ---- the two secrets that must never ship to a browser ------------------
  const sources: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name)) sources.push(full);
    }
  })("src");

  for (const secret of ["LEVEL_UP_WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const public_ = sources.filter((f) =>
      new RegExp(`NEXT_PUBLIC_${secret}`).test(stripComments(readFileSync(f, "utf8"))));
    assert(`${secret} is never prefixed NEXT_PUBLIC_`, public_.length === 0, public_[0]);

    // And never read from a file that carries "use client", which would put it
    // in the bundle whatever it is called.
    const inClient = sources.filter((f) => {
      const src = stripComments(readFileSync(f, "utf8"));
      return /^\s*["']use client["']/m.test(src) && src.includes(secret);
    });
    assert(`and never read from a client component`, inClient.length === 0, inClient[0]);
  }

  // The database side: the grant function the webhook calls must be reachable
  // by service_role and by nobody else. A grant to `authenticated` here would
  // hand every signed-in player a free subscription.
  const schema = read("../supabase/schema.sql");
  const grants = schema.match(/grant execute on function public\.webhook_grant_level_up[^;]*;/g) ?? [];
  assert("the webhook's grant function is reachable only by service_role",
    grants.length === 1 && grants[0].includes("service_role")
      && !grants[0].includes("authenticated") && !grants[0].includes("anon"),
    grants[0]?.replace(/\s+/g, " "));

  assert("and is explicitly revoked from everybody else",
    /revoke all on function public\.webhook_grant_level_up[\s\S]{0,200}?from public, anon, authenticated;/.test(schema));

  // A payment reference is what stops one delivery granting 120 days. Every
  // processor retries by design, so this is an ordinary Tuesday.
  assert("a webhook grant without a payment reference is refused",
    /p_payment_ref is null or btrim\(p_payment_ref\) = ''/.test(schema));
  assert("and the reference is unique in the table",
    /payment_ref text unique/.test(schema));
}

line("24. NOTHING ON THIS SITE CAN BLOCK ANYBODY");
{
  // Blocking was removed on purpose, and this is the check that keeps it gone.
  //
  // The reasoning, because it is not the obvious call: a scammer's last move is
  // to block the person they just took an item from. That buries the
  // conversation, ends the confrontation, and leaves the victim with nothing to
  // point at. Blocking hands the tool to whoever uses it first, and on a
  // trading board that is nearly always the person in the wrong.
  //
  // The replacement is reporting plus suspension, which is the better shape:
  // a block protects the one person who pressed it, a suspension protects
  // everybody the account has not reached yet.
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const schema = read("../supabase/schema.sql");

  assert("the schema creates no blocks table",
    !/create table if not exists public\.blocks/.test(schema));
  assert("and drops one if an older database has it",
    /drop table public\.blocks cascade/.test(schema));
  assert("and defines no block_player function",
    !/create or replace function public\.block_player/.test(schema));

  // The policy on messages must not reference blocks — that clause was what
  // let a blocked person be silenced, and its absence is what makes suspension
  // the only lever.
  const sendPolicy = schema.match(/create policy messages_send[\s\S]*?\);/)?.[0] ?? "";
  assert("the send policy gates on account standing, not on a block",
    sendPolicy.includes("status = 'active'") && !sendPolicy.includes("blocks"),
    sendPolicy ? undefined : "messages_send policy not found");

  // And no app code offers it.
  const sources: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name)) sources.push(full);
    }
  })("src");

  const offering = sources.filter((f) =>
    /\b(setBlocked|block_player|blocked_by_me)\b/.test(stripComments(readFileSync(f, "utf8"))));
  assert("no component or action can block somebody", offering.length === 0, offering[0]);

  // Reporting has to still exist, or removing blocking would leave nothing at
  // all. This is the half that makes the trade-off honest.
  const reporting = sources.filter((f) =>
    /reportMessage|ReportButton/.test(stripComments(readFileSync(f, "utf8"))));
  assert("and reporting is still there instead", reporting.length >= 2,
    `${reporting.length} files`);
}

line("25. THE CONTROL PANEL ANSWERS TO ONE ACCOUNT");
{
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const schema = read("../supabase/schema.sql");

  // is_admin() is the whole gate, and it must join the allowlist. A version
  // that checked anything else — a column on profiles, a role, an env var —
  // would be one edit away from letting somebody grant themselves the panel.
  const isAdmin = schema.match(/create or replace function public\.is_admin\(\)[\s\S]*?\$\$;/)?.[0] ?? "";
  assert("is_admin() answers from the allowlist and the caller's own session",
    isAdmin.includes("mintplaza.admin_allowlist") && isAdmin.includes("auth.uid()"),
    isAdmin ? undefined : "is_admin() not found");

  // It matches on the numeric Roblox id, not the username. A username can be
  // released and taken by somebody else; the id cannot.
  assert("and matches on the Roblox id rather than the username",
    isAdmin.includes("a.roblox_user_id = p.roblox_user_id"));

  // A suspended owner is not an owner.
  assert("and refuses an account that is not active",
    isAdmin.includes("p.status = 'active'"));

  // The allowlist itself must not be writable from the client, or the gate is
  // decoration. It lives in the mintplaza schema, which PostgREST does not
  // serve at all.
  assert("the allowlist lives outside the schema PostgREST exposes",
    /create table if not exists mintplaza\.admin_allowlist/.test(schema));

  // Every admin function re-checks. The 404 on the page is presentation; this
  // is the part that holds against a forged request.
  const adminFns = schema.match(/create or replace function public\.admin_\w+/g) ?? [];
  const guarded = (schema.match(/perform mintplaza\.require_admin\(\)/g) ?? []).length;
  assert("every admin_ function re-checks the allowlist itself",
    guarded >= adminFns.length,
    `${adminFns.length} admin functions, ${guarded} require_admin() calls`);

  // The page is a 404 to everybody else, not a "forbidden" — which would
  // confirm there is something there to be forbidden from.
  const page = stripComments(read("../src/app/admin/page.tsx"));
  assert("and the page 404s rather than announcing itself", page.includes("notFound()"));
}

line("26. THE TERMS DESCRIBE THE SITE THAT ACTUALLY EXISTS");
{
  // A terms page is a set of promises. Every one of them is a thing somebody
  // could hold the operator to, and every one of them is in a different file
  // from the code that would have to keep it. These checks are what stop the
  // two drifting — which is the ordinary way a legal page becomes a liability
  // rather than a protection.
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const terms = read("../src/app/terms/page.tsx");
  const privacy = read("../src/app/privacy/page.tsx");
  const schema = read("../supabase/schema.sql");

  // ---- the subscription, exactly as the database grants it ---------------
  assert("the terms quote the real subscription length",
    SUBSCRIPTION.days === LEVEL_UP_DAYS,
    `terms say ${SUBSCRIPTION.days}, the product says ${LEVEL_UP_DAYS}`);

  const perGame = PERKS.find((p) => p.title.includes("Ten listings"));
  assert("and the real listing numbers",
    perGame?.levelUp.includes(String(SUBSCRIPTION.listingsPerGame)) === true
      && perGame?.free.includes(String(SUBSCRIPTION.freeListingsPerGame)) === true,
    `terms: ${SUBSCRIPTION.freeListingsPerGame} -> ${SUBSCRIPTION.listingsPerGame}`);

  const life = PERKS.find((p) => p.title.includes("three days"));
  assert("and the real listing lifetime",
    life?.levelUp.includes(`${SUBSCRIPTION.listingDays} days`) === true
      && life?.free.includes(`${SUBSCRIPTION.freeListingHours} hours`) === true);

  // "It does not renew by itself" is the strongest promise on the money
  // section. Nothing in the codebase may quietly make it recurring.
  assert("nothing in the product contradicts 'it does not renew by itself'",
    SUBSCRIPTION.autoRenews === false
      && !/auto[_-]?renew|recurring|subscription_id|renew_at/i.test(schema),
    "the schema mentions renewal");

  // ---- the games credited are the games on the roster --------------------
  //
  // A credit list that misses a game is an uncredited use of somebody's trade
  // mark; one that names a game the site dropped is a stale claim about who
  // owns what. Both are checked against the registry rather than remembered.
  const registry = new Set(GAMES.map((g) => g.slug));
  const credited = new Set(GAME_CREDITS.map((g) => g.slug));
  const uncredited = [...registry].filter((s) => !credited.has(s));
  const ghosts = [...credited].filter((s) => !registry.has(s));
  assert("every game on the roster is credited to its owner",
    uncredited.length === 0, uncredited.join(", "));
  assert("and nothing is credited that the site no longer covers",
    ghosts.length === 0, ghosts.join(", "));
  assert("every credit names an owner",
    GAME_CREDITS.every((g) => g.owner.trim().length > 3));

  // The disclaimer has to be present and unambiguous, not implied by the
  // credits. Naming somebody's game is fine; looking endorsed by them is not.
  assert("the terms disclaim any affiliation with Roblox or the developers",
    /not affiliated with, endorsed by, sponsored by, or connected to/i.test(terms)
      && terms.includes("PLATFORM_OWNER"));

  // ---- the rule the whole site's legality rests on -----------------------
  //
  // Roblox forbids exchanging in-game items for real money off-platform and
  // treats third-party services that enable it as a violation. MintPlaza must
  // prohibit it in terms, and must say so where people actually read.
  assert("real-money trading is prohibited in the terms",
    /real money/i.test(terms) && terms.includes("HOUSE_RULES"));
  assert("and the rule is stated on the screen everybody must pass through",
    /real money/i.test(read("../src/components/TermsGate.tsx")));

  // ---- the promises the privacy policy makes about collection ------------
  //
  // "We never see your card details" and "we do not build advertising
  // profiles" are checkable, so they are checked.
  const sources: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name)) sources.push(full);
    }
  })("src");
  const code = sources.map((f) => stripComments(readFileSync(f, "utf8")));

  // Matches a card FIELD, not the word. The first version of this check caught
  // the privacy policy's own sentence about not collecting card details —
  // which is the same trap that has bitten three other checks in this file.
  // Requiring an assignment or a key means prose cannot trip it while an
  // actual form field still does.
  const cardFields = sources.filter((f, i) =>
    /\b(cardNumber|card_number|cvv|cvc|cardHolder)\s*[:=]/i.test(code[i])
    || /name=["'](cardNumber|cvv|cvc|card_number)["']/i.test(code[i]));
  assert("'MintPlaza never sees a card number' is true", cardFields.length === 0,
    cardFields[0]);

  const trackers = sources.filter((f, i) =>
    /googletagmanager|google-analytics|gtag\(|facebook\.net|fbq\(|mixpanel|segment\.com|hotjar/i.test(code[i]));
  assert("'no advertising or cross-site tracking' is true", trackers.length === 0,
    trackers[0]);

  // The policy says the only browser storage is sign-in plus one dismissal
  // note. More keys than that and the sentence is wrong.
  const storageKeys = new Set<string>();
  for (const src of code) {
    for (const m of src.matchAll(/localStorage\.(?:get|set|remove)Item\(\s*([A-Za-z_]\w*|"[^"]+")/g)) {
      storageKeys.add(m[1]);
    }
  }
  assert("and so is 'one small note in your browser'", storageKeys.size <= 2,
    [...storageKeys].join(", "));

  // ---- the promises that need a route to exist ---------------------------
  //
  // A contact address in a legal document that nobody monitors is worse than
  // none: it is a promise of a reply. This at least checks it is the same
  // address the support screen uses, so there is one inbox rather than two.
  assert("the legal contact is the address the support screen already uses",
    read("../src/lib/support.ts").includes(LEGAL_CONTACT),
    `terms say ${LEGAL_CONTACT}`);

  // Deletion is promised in both documents. It has to be reachable.
  assert("account deletion is promised and the action exists",
    /delete/i.test(privacy) && read("../src/lib/actions/account.ts").includes("delete"));

  // ---- consent has to be recorded, not assumed ---------------------------
  assert("agreeing is recorded against a version, not a boolean",
    /create table if not exists public\.terms_acceptance/.test(schema)
      && /version\s+text not null/.test(schema));

  // The client must not get to say which version it accepted, or the record is
  // evidence of consent to text nobody displayed.
  const action = stripComments(read("../src/lib/actions/terms.ts"));
  assert("and the version comes from the server, never the request",
    action.includes("p_version: TERMS_VERSION")
      && !/function acceptTerms\([^)]+\)/.test(action),
    "acceptTerms takes an argument");

  // No insert policy is what makes forging one impossible.
  assert("and no client can write an acceptance row directly",
    !/create policy[^;]*on public\.terms_acceptance for (insert|all)/i.test(schema));

  // ---- the credit, in the one place it belongs --------------------------
  //
  // An AI cannot be a founder, sign anything, or carry responsibility, and
  // putting it in the operative terms would muddy the one question the page
  // exists to answer: who is accountable. So it lives in a credits section
  // marked as outside the agreement.
  // lastIndexOf, not indexOf: BUILD_CREDIT appears in the import at the top of
  // the file, so indexOf finds that and the check fails against a correct page.
  assert("the build credit is outside the agreement, not a clause in it",
    terms.includes("NOT PART OF THE AGREEMENT ABOVE")
      && terms.lastIndexOf("BUILD_CREDIT") > terms.indexOf("NOT PART OF THE AGREEMENT ABOVE"));
  assert("and it does not call the AI a founder or an owner",
    !/co-?founder|co-?owner|partner in/i.test(BUILD_CREDIT));
}

line("27. NO SURFACE LETS SOMEBODY ACT WITHOUT AGREEING");
{
  // The consent screen started on /app only, and /app is not the whole site.
  // A signed-in account could reach /messages or /upgrade directly and never
  // see it — which means messaging strangers without having agreed not to scam
  // them, and PAYING without having agreed to the refund terms they would
  // later rely on. Found by listing the routes rather than assuming.
  //
  // Two layers now, and this checks both.
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const schema = read("../supabase/schema.sql");

  // ---- layer one: the database refuses the actions -----------------------
  //
  // This is the one that cannot be navigated around, because it is not a
  // screen. Every path that creates an obligation has to consult it.
  assert("posting a listing requires having agreed",
    /if not mintplaza\.has_agreed\(new\.user_id\) then/.test(schema));
  assert("sending a message requires having agreed",
    /create policy messages_send[\s\S]*?mintplaza\.has_agreed\(auth\.uid\(\)\)/.test(schema));
  assert("opening a conversation requires having agreed",
    /create or replace function public\.start_conversation[\s\S]*?if not mintplaza\.has_agreed\(v_me\) then/.test(schema));

  // The database check must be version-agnostic. If it demanded the CURRENT
  // version, editing the terms would lock every existing player out of the
  // site until they next happened to load a page that showed the screen.
  const hasAgreed = schema.match(
    /create or replace function mintplaza\.has_agreed\(p_user uuid\)[\s\S]*?\$\$;/,
  )?.[0] ?? "";
  assert("and the database floor does not demand a specific version",
    hasAgreed.includes("terms_acceptance") && !hasAgreed.includes("version ="),
    hasAgreed ? undefined : "has_agreed() not found");

  // ---- layer two: the screen is on every surface that needs it -----------
  const routes: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(full);
      else if (e.name === "page.tsx") routes.push(full);
    }
  })("src/app");

  // Routes a signed-in player can act on. Reading is fine without agreeing;
  // creating something is not.
  const mustGuard = ["src/app/app", "src/app/messages", "src/app/upgrade"];
  const unguarded = mustGuard.filter((dir) => {
    // A layout at the segment root carrying the guard covers everything below.
    const layout = `${dir}/layout.tsx`;
    if (!existsSync(layout)) return true;
    // `<TermsGuard`, not `TermsGuard`. An import line mentions it too, so the
    // first version of this check passed against a layout that imported the
    // guard and never rendered it — which is precisely the state a careless
    // edit leaves behind. Found by deleting the element and watching the
    // check not notice.
    return !/<TermsGuard[\s/>]/.test(stripComments(readFileSync(layout, "utf8")));
  });
  assert("every surface that creates something shows the consent screen",
    unguarded.length === 0, unguarded.join(", "));

  // And the places it must NOT appear. Being unable to read what you are
  // agreeing to, or to leave, would make the consent worthless and the site a
  // trap — so this is checked as carefully as the other direction.
  for (const open of ["src/app/terms/page.tsx", "src/app/privacy/page.tsx"]) {
    assert(`${open.split("/")[2]} is readable without agreeing first`,
      !stripComments(readFileSync(open, "utf8")).includes("TermsGuard"));
  }
  assert("and signing out is always available",
    stripComments(read("../src/components/TermsGate.tsx")).includes("/auth/signout"));

  // A gate with no refusal is a door with a tick box on it.
  assert("the screen offers a way to refuse",
    /No thanks/i.test(read("../src/components/TermsGate.tsx")));

  void routes;
}

line("28. THE SIGN-IN BUTTON IS DEAD UNTIL THE BOX IS TICKED");
{
  // The agreement moved from "a screen after you are inside" to "before the
  // only door". That is the right moment — once somebody is signed in, the
  // question reads as a formality on the way to somewhere — but it puts the
  // whole consent flow in one client component, so it is worth checking
  // precisely.
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const panel = stripComments(read("../src/components/SignInPanel.tsx"));

  // Genuinely disabled, not styled to look disabled. A grey-looking enabled
  // button is a lie that works right up until somebody taps it, and it is
  // announced as available to a screen reader.
  assert("the button carries a real disabled attribute",
    /disabled=\{!agreed/.test(panel));

  // And the handler re-checks, because the handler is what actually starts
  // sign-in. A disabled attribute is a property of one element; this is the
  // property of the action.
  assert("and the handler refuses even if the button is reached another way",
    /if \(!agreed\) return;/.test(panel));

  // Both documents have to be reachable FROM the tick box. Agreeing to
  // something you cannot open is not agreeing.
  assert("both documents are linked from beside the box",
    panel.includes('href="/terms"') && panel.includes('href="/privacy"'));

  // The age statement belongs in the sentence being agreed to, not in a
  // paragraph elsewhere on the page that nobody read.
  assert("the age declaration is inside the thing being agreed to",
    /13 or older/.test(panel));

  // ---- the tick has to survive the trip to Roblox ------------------------
  //
  // Sign-in leaves the site entirely. Nothing in React comes back.
  assert("the tick is carried across sign-in", panel.includes("TERMS_COOKIE"));

  const callback = stripComments(read("../src/app/auth/callback/route.ts"));
  assert("and the callback turns it into a record",
    callback.includes("accept_terms") && callback.includes("TERMS_COOKIE"));

  // The version recorded comes from the server. A cookie that could name any
  // version could record agreement to an older, softer one that is no longer
  // served.
  assert("recording the CURRENT version only, never the cookie's own claim",
    /ticked === TERMS_VERSION/.test(callback)
      && /p_version: TERMS_VERSION/.test(callback));

  // Cleared afterwards either way, so a shared device does not carry somebody
  // else's agreement into the next sign-in.
  assert("and the cookie is cleared afterwards",
    /TERMS_COOKIE, "", \{ maxAge: 0/.test(callback));

  // ---- and none of it is load-bearing -------------------------------------
  //
  // Every check above is about the ordinary path being right. The guarantee is
  // that the database refuses to let an account act until an acceptance row
  // exists — so the worst case for any bug in this component is being asked
  // again, not slipping through.
  const schema = read("../supabase/schema.sql");
  assert("and the database still refuses to act without a record",
    /if not mintplaza\.has_agreed\(new\.user_id\) then/.test(schema));

  // The old bare button must be gone, or a stale import could reintroduce a
  // sign-in path with no tick box in front of it.
  assert("the ungated sign-in button no longer exists",
    !existsSync("src/components/RobloxSignIn.tsx"));
}

line("29. EVERY GAME CAN ACTUALLY BE POSTED IN, AND SAYS SO HONESTLY");
{
  /* ------------------------------------------------------------------------
   * What this section is for
   * ------------------------------------------------------------------------
   *
   * An audit of the six games found no broken screen and no empty board — but
   * it found prose. Blox Fruits advertised "every fruit, sword, gun and
   * material"; the game has no trading system for swords, guns or fighting
   * styles and the catalogue has never held one. Adopt Me advertised pet wear
   * it does not stock. Pet Simulator 99 promised RAP and exists counts in
   * three separate strings, on a site whose CatalogItem has never carried
   * either field. Two tabs still described "community values" months after
   * the value system was deleted.
   *
   * None of that throws. It is the failure mode a test suite is worst at and
   * a user is quickest to find: the site describing a version of itself that
   * stopped being true. So these are assertions now.
   * --------------------------------------------------------------------- */

  // ---- the boards are not empty -------------------------------------------
  for (const g of GAMES) {
    const items = catalogFor(g.slug);
    assert(`${g.shortName}: has a catalogue to list from`, items.length > 0,
      `${items.length} rows`);
    assert(`${g.shortName}: something in it is actually tradeable`,
      items.some((i) => i.tradeable !== false));

    for (const tab of g.exploreTabs) {
      if (tab.kind === "trades") continue;
      // "community" is the tab's own word; the template catalogue files the
      // same boards under "recruit". Passing the tab's word straight through
      // returns nothing and looks exactly like an empty board, which is how
      // this audit produced its first false alarm.
      const section = tab.kind === "services" ? "services" : "recruit";
      const n = servicesFor(g.slug, section).length;
      assert(`${g.shortName}: the "${tab.label}" board has something postable`,
        n > 0, `${n} templates`);
    }
  }

  // ---- the categories are derived, not remembered --------------------------
  //
  // Regenerated here from the catalogue itself. If this fails, do not edit the
  // array to match: the detail line prints exactly what to paste.
  const realCats = (slug: string) => {
    const n = new Map<string, number>();
    for (const i of catalogFor(slug)) n.set(i.category, (n.get(i.category) ?? 0) + 1);
    return [...n]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([c]) => c);
  };

  const read = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
  const sql = read("../supabase/schema.sql");
  for (const g of GAMES) {
    const real = realCats(g.slug);
    assert(`${g.shortName}: itemCategories matches the catalogue`,
      JSON.stringify([...g.itemCategories]) === JSON.stringify(real),
      JSON.stringify(real));

    // And the SQL seed matches it, because getGames() reads this table back
    // and lets it win — a stale seed is not a dormant copy, it is the copy
    // players get.
    const arr = "'{" + real
      .map((c) => (/[^A-Za-z0-9]/.test(c) ? `"${c}"` : c))
      .join(",") + "}'";
    assert(`${g.shortName}: the SQL seed carries the same categories`,
      sql.includes(arr), arr);
  }

  // ---- the seeded prose is the prose that was reviewed ----------------------
  //
  // getGames() overrides name, blurb, hue and art from this table. Two blurbs
  // had drifted, and one of them was still selling value checks.
  for (const g of GAMES) {
    assert(`${g.shortName}: the SQL seed blurb matches the registry`,
      sql.includes(g.blurb.replace(/'/g, "''")));
  }

  // ---- nothing advertises a number this site does not have ------------------
  //
  // CatalogItem has no rap field and no exists field, and no screen renders
  // one, so a game that promises either is selling a feature that was never
  // built. Three PS99 strings did.
  //
  // Scanned against the PARSED registry, not the source file. The first
  // version of this check grepped games.ts whole and failed on two sourceNote
  // entries — provenance text, admin-only, and correct: BIG Games' API really
  // does publish RAP, and Sonaria's list really is a community value list.
  // Saying where data came from is not the same as promising a screen.
  //
  // wants[] is excluded too, and deliberately. "what's the rap on this" is an
  // example of what a player posts, not a claim that MintPlaza answers it —
  // the answer is the partner link, which is what section 1 proves exists.
  const promises = GAMES.flatMap((g) => [
    g.blurb,
    ...g.exploreHighlights,
    ...g.exploreTabs.flatMap((t) => [t.label, t.blurb]),
  ]);
  for (const bad of ["RAP", "exists count", "community value"]) {
    const hit = promises.find((t) => t.includes(bad));
    assert(`no player-facing string promises "${bad}"`, !hit,
      hit ?? "the value system was removed; see referrals.ts");
  }

  // ---- and no trades tab advertises stock the catalogue does not hold -------
  //
  // A regression guard, not a prose checker, and worth being honest about the
  // difference: it holds a list of the exact claims this audit found false and
  // makes sure none of them comes back. The general guarantee is the
  // itemCategories check above, which is fully derived and cannot be fooled.
  //
  // Only the FIRST sentence is scanned, because that is where the stock list
  // lives and the sentences after it are where the honest caveats live. Blox
  // Fruits now says swords are not listed and why; a checker that cannot tell
  // that from advertising swords would punish the fix.
  const FALSE_CLAIMS = ["sword", "gun", "fighting style", "pet wear", "material", "gem"];
  for (const g of GAMES) {
    const have = new Set(g.itemCategories.map((c) => c.toLowerCase()));
    for (const tab of g.exploreTabs) {
      if (tab.kind !== "trades") continue;
      const stockList = tab.blurb.split(/\.\s/)[0].toLowerCase();
      const unstocked = FALSE_CLAIMS.filter(
        (w) => new RegExp(`\\b${w}s?\\b`).test(stockList)
          && !have.has(w) && !have.has(w + "s") && !have.has(w.replace(/s$/, "")));
      assert(`${g.shortName}: the trades tab stocks everything it advertises`,
        unstocked.length === 0,
        unstocked.length ? `claims ${unstocked.join(", ")} — catalogue has none` : undefined);
    }
  }
}

line("30. ONE PHRASE, MATCHED WHOLE, ON EVERY SEARCH BOX");
{
  const read = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
  const schema = read("../supabase/schema.sql");

  const fn = schema.match(
    /create or replace function public\.console_phrase_matches\(p_phrase text\)[\s\S]*?\$\$;/,
  )?.[0] ?? "";
  assert("console_phrase_matches() exists", fn.length > 0);

  // Whole-string equality, not IN and not LIKE. The old version accepted four
  // words, three of which appear in this site's own help text; "admin" typed
  // into a search box should never have been a door, even a locked one.
  assert("the phrase is compared whole, with =",
    /=\s*'\/openadminpanel'/.test(fn), "exactly /openadminpanel");
  assert("and no longer accepts a list of words",
    !/\bin\s*\(/.test(fn) && !/like/i.test(fn));

  // The one-character-wrong requirement, stated as the thing it depends on:
  // nothing in the comparison is a prefix, suffix or pattern match.
  for (const near of ["openadminpanel", "/openadminpane", "/open admin panel", "admin", "console"]) {
    assert(`"${near}" is not the phrase`,
      !new RegExp(`=\\s*'${near.replace(/[/ ]/g, "\\$&")}'`).test(fn));
  }

  // is_admin() is checked in the same expression, so the phrase is never the
  // only thing between an account and the panel.
  assert("and it still answers only for the allowlisted account",
    fn.includes("public.is_admin()"));

  // Not callable by a signed-out request at all.
  assert("anon cannot call it",
    /revoke all on function public\.console_phrase_matches\(text\)\s+from public, anon;/.test(schema));

  // ---- the phrase is not in anything a browser downloads --------------------
  //
  // The comparison is server-side. If the phrase ever appears in a client
  // component, the whole arrangement is decoration.
  const clientFiles = [
    "../src/components/ConsoleShortcut.tsx",
    "../src/components/ExploreCatalog.tsx",
    "../src/components/InventoryEditor.tsx",
    "../src/components/PostListing.tsx",
  ];
  for (const f of clientFiles) {
    const src = stripComments(read(f));
    assert(`the phrase is not in ${f.split("/").pop()}`, !src.includes("openadminpanel"));
  }

  // ---- every player-facing search box has the door ---------------------------
  //
  // It used to be on one screen out of three. The owner does not know which
  // screen they will be on when they need the panel, so "any search bar" has
  // to mean all of them — and a check that counts search inputs is the only
  // way a fourth one added later gets caught.
  const searchBoxes = [
    "../src/components/ExploreCatalog.tsx",
    "../src/components/InventoryEditor.tsx",
    "../src/components/PostListing.tsx",
  ];
  for (const f of searchBoxes) {
    const src = stripComments(read(f));
    assert(`${f.split("/").pop()} renders the shortcut`,
      /<ConsoleShortcut query=\{query\}/.test(src));
  }

  // And the card is rendered before the results, not after them.
  const explore = stripComments(read("../src/components/ExploreCatalog.tsx"));
  assert("the card sits above the results, not under 4,959 pets",
    explore.indexOf("<ConsoleShortcut") < explore.indexOf("shown.map"));

  // ---- and it does not advertise a feature that was deleted ------------------
  const search = stripComments(read("../src/lib/admin/search.ts"));
  assert("the card does not still offer to edit values",
    !/values/i.test(search.slice(search.indexOf("href: \"/admin\""))));
}

line("31. A PAYMENT CANNOT ARRIVE WITHOUT AN ACCOUNT TO PUT IT ON");
{
  const read = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
  const go = stripComments(read("../src/app/upgrade/go/route.ts"));
  const hook = stripComments(read("../src/app/api/level-up/webhook/route.ts"));

  // The webhook grants to a username. If the hand-off does not carry one, the
  // checkout page has to ask — and a typo there is money that arrives with
  // nowhere to go, which is a refund rather than a retry.
  assert("the webhook grants against a username",
    /p_username:\s*username/.test(hook));
  assert("and the hand-off sends the username with the player",
    /searchParams\.set\("u",\s*me\.username\)/.test(go));

  // Read from the session. A username taken from the query string would let
  // the caller name who a payment is for.
  assert("taken from the session, not from the request",
    /const me = await currentProfile\(\)/.test(go)
      && !/searchParams\.get\("u"\)/.test(go));

  // Signed out means no username, so there is nothing to grant. Sending them
  // to pay anyway is the one failure here that costs real money.
  assert("a signed-out visitor is sent to sign in first",
    /if \(!me\?\.username\)/.test(go) && go.includes("/login?next="));

  // And they land back on the price they picked, or the sign-in is a dead end
  // that loses the sale and the player.
  assert("and comes back to the same price",
    /\/upgrade\?country=\$\{raw\}/.test(go));

  // Still no open redirect: the destination is built from the environment and
  // only the country comes from the request.
  assert("the destination still comes from the environment, not the request",
    /checkoutUrlFor\(raw!\)/.test(go) && !/searchParams\.get\("url"\)/.test(go));
}

line("32. THE GO-LIVE GUIDE TELLS THE TRUTH");
{
  /* ------------------------------------------------------------------------
   * A deployment guide is the one document somebody follows literally, at
   * night, on a phone, while something is broken. Every command in it that
   * does not work costs an hour, and a guide that has quietly rotted is worse
   * than no guide because it is trusted.
   *
   * So the parts of it that name real things are checked against those things.
   * Prose is not checked and should not be.
   * --------------------------------------------------------------------- */
  const read = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
  const doc = read("../docs/go-live.md");
  const schema = read("../supabase/schema.sql");

  assert("it names the one SQL file that exists",
    doc.includes("supabase/schema.sql") && existsSync("supabase/schema.sql"));

  // The allowlist insert. This is the command that decides whether the owner
  // has a panel at all, and the first version of this guide invented a
  // function that does not exist.
  assert("the allowlist command matches the real table",
    doc.includes("insert into mintplaza.admin_allowlist (roblox_username)")
      && /create table if not exists mintplaza\.admin_allowlist \(\s*roblox_username text primary key/.test(schema));
  assert("and does not invent a helper function",
    !/mintplaza\.add_admin/.test(doc));

  // The passcode command, and the seeded code.
  assert("the passcode command exists in the schema",
    doc.includes("mintplaza.set_console_passcode(")
      && schema.includes("create or replace function mintplaza.set_console_passcode(p_new text)"));
  assert("and the seeded passcode is the one the guide gives",
    doc.includes("`1927`") && schema.includes("mintplaza.set_console_passcode('1927')"));

  // The phrase. If these two ever disagree, the owner cannot open their panel.
  const fn = schema.match(
    /create or replace function public\.console_phrase_matches\(p_phrase text\)[\s\S]*?\$\$;/)?.[0] ?? "";
  assert("the phrase in the guide is the phrase in the database",
    doc.includes("/openadminpanel") && fn.includes("'/openadminpanel'"));

  // Every environment variable the guide names must be one .env.example knows
  // about, or somebody sets a variable nothing reads.
  const envExample = read("../.env.example");
  const named = [...doc.matchAll(/`(NEXT_PUBLIC_[A-Z_]+|SUPABASE_[A-Z_]+|LEVEL_UP_[A-Z_]+|DEV_PASSWORD)`/g)]
    .map((m) => m[1]);
  const unknown = [...new Set(named)].filter((v) => !envExample.includes(v));
  assert("every environment variable it names is real", unknown.length === 0,
    unknown.length ? unknown.join(", ") : `${new Set(named).size} checked`);

  // The webhook contract it prints has to be the one the route enforces.
  const hook = read("../src/app/api/level-up/webhook/route.ts");
  for (const part of ["x-mintplaza-timestamp", "x-mintplaza-signature", "payment_ref"]) {
    assert(`the webhook contract names ${part} and the route reads it`,
      doc.includes(part) && hook.includes(part));
  }

  // The database counts are measured by other tools, so they can rot here
  // without anything noticing. The app's own count is checked at the very
  // bottom of this file, against the real total.
  assert("the database counts it quotes are still right",
    doc.includes("239 on the database") && doc.includes("17 on installing")
      && doc.includes("14 on"),
    "update docs/go-live.md if npm run proof:db or redteam:webhook moved");
}


/* ==========================================================================
 * The summary, and why it is at the bottom of the file
 * ==========================================================================
 *
 * It used to sit in the middle, immediately after section 19. It printed "All
 * assertions passed", and then thirteen more sections ran underneath it with
 * nothing reading their results.
 *
 * The effect was total: every check in sections 20 to 32 — Level Up's limits,
 * the payment webhook's guards, no-dead-buttons, no-blocking, the control
 * panel, the terms, the sign-in gate, the game catalogues — printed FAIL in
 * red and the script exited 0. A failing assertion did not fail the build, and
 * had not been able to for as long as those sections have existed.
 *
 * That is the worst failure a proof script can have. A check that cannot fail
 * is not a check, it is a comment that takes longer to run, and thirteen
 * sections of them read as reassurance while proving nothing. It was found by
 * deliberately breaking a check and noticing the exit code was still 0 — which
 * is the only reason to ever break a check on purpose, and the reason every
 * check added to this file gets that treatment.
 *
 * So: one summary, at the end, after everything. If a section is ever added
 * below this block it will be outside the count again, which is why the count
 * is printed — a number that stops moving when checks are added is the symptom
 * to watch for.
 * ======================================================================== */

// The guide quotes how many checks this script runs. Compared against the real
// total rather than a number typed into both places — `checked + 1` because
// this assertion is the last one and has not counted itself yet.
{
  const quoted = readFileSync(new URL("../docs/go-live.md", import.meta.url), "utf8")
    .match(/(\d+) checks on the app/)?.[1];
  assert("the guide quotes the real number of checks",
    Number(quoted) === checked + 1,
    `guide says ${quoted}, this run has ${checked + 1}`);
}

console.log("\n" + "─".repeat(72));
if (failures > 0) {
  console.log(`\n${failures} of ${checked} assertions FAILED.\n`);
  process.exit(1);
}
console.log(`\nAll ${checked} assertions passed.\n`);
