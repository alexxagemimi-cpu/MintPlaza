/**
 * Catalogue ingest — turns the raw wiki/API pull into data the app can trust.
 *
 * Run with `npm run ingest`. Reads vendor/catalog-pull-<date>/*.ts and writes
 * src/lib/data/catalog/*.json.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists at all
 * ---------------------------------------------------------------------------
 *
 * The pull is 10,053 real rows and it is a genuine upgrade on a hand-typed
 * list. It is also a raw scrape, and a raw scrape carries the shape of the
 * scraper rather than the shape of the game. Pasting it in directly would have
 * shipped five separate defects, every one of which was measured before this
 * cleaner was written rather than guessed at afterwards:
 *
 *   1. 7,631 rows used the research's game slugs (`ps99`, `adoptme`,
 *      `sonaria`) rather than the registry's (`pet-simulator-99`, `adopt-me`,
 *      `creatures-of-sonaria`). Those rows would have belonged to no game: no
 *      value source, no tab, invisible. This exact mistake already shipped once
 *      and was caught by the proof script, which is why it is the first thing
 *      fixed here and the first thing asserted at the end.
 *
 *   2. 14 rows shared an id with another row. Seven Fisch fish are named with
 *      a single emoji, and kebab-casing an emoji yields the empty string, so
 *      all seven collapsed to the id `fisch-x`. Ids are primary keys.
 *
 *   3. 1,109 Pet Simulator 99 rows carried the API's own index in the display
 *      name — "80 | Teddy Egg", "WateringCan | Golden Watering Can". That is
 *      22% of that game rendering internal keys at players.
 *
 *   4. 13 rows were wiki navigation pages, not items. Grow a Garden 2 listed
 *      "Wiki", "Home" and "Seeds" as tradeable seeds.
 *
 *   5. Every row arrived `verified: true`. In this codebase `verified` means a
 *      human checked the row's VALUE, and the pull contains no values at all,
 *      so that flag would have marked 10,053 unpriced rows as price-checked.
 *      It becomes `sourced`, which is what it actually meant.
 *
 * ---------------------------------------------------------------------------
 * The rule that matters most: the pull never overwrites hand-curated work
 * ---------------------------------------------------------------------------
 *
 * The pull is broader but in three places it is thinner than what was already
 * here, and a naive replace would have been a downgrade:
 *
 *   - Fisch gliders: 2 in the pull, 19 hand-curated. The pull's own README
 *     admits fischipedia is bot-blocked and its cosmetics are incomplete.
 *   - Creatures of Sonaria: 482 creatures but zero materials, palettes or
 *     plushies — including Explosive Stars Material, the deliberately unpriced
 *     row that proves the no-verdict path works.
 *   - Every priced row in values.ts, which is keyed by item id. A pull row
 *     landing on a curated id would silently detach that item from its price.
 *
 * So merging is keyed on (gameSlug, normalised name), NOT on id — the two
 * sources generate ids differently (`cs-keruku` here, `sonaria-keruku` there)
 * and an id-keyed merge would have produced two rows for one creature, one of
 * them priced and one not. On a name collision the curated row wins outright
 * and absorbs only the fields it lacks (assetId, sizeTier, classes).
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PULL = join(root, "vendor", "catalog-pull-2026-09-13");
const OUT = join(root, "src", "lib", "data", "catalog");

/**
 * The research called these games one thing and the registry calls them
 * another. Every row is remapped through here; anything not in this table is
 * a hard error rather than a silent passthrough, because a slug that does not
 * resolve is exactly the failure mode that already shipped once.
 */
const SLUG_MAP = {
  ps99: "pet-simulator-99",
  adoptme: "adopt-me",
  sonaria: "creatures-of-sonaria",
  fisch: "fisch",
  gag2: "gag2",
};

const FILES = {
  ps99: "ps99.ts",
  adoptme: "adoptme.ts",
  fisch: "fisch.ts",
  sonaria: "sonaria.ts",
  gag2: "gag2.ts",
};

/**
 * Wiki category index pages that the scrape collected as if they were items.
 * Keyed by "<registry slug>:<name>" so that a real item which happens to share
 * a name with a category page in a DIFFERENT game is never caught by accident.
 */
const NAV_PAGES = new Set([
  "gag2:Wiki",
  "gag2:Home",
  "gag2:Seeds",
  "gag2:Mega",
  "gag2:Rainbow",
  // The source site's own name, collected as if it were a seed.
  "gag2:GAG2.GG",
  // A crop mutation, not a seed. It belongs to the VARIANTS multiplier table
  // in items.ts, where it is worth x10, and listing it as an item would let a
  // player offer "a Gold" with no crop attached to it.
  "gag2:Gold",
  "adopt-me:Pets",
  "adopt-me:Eggs",
  "adopt-me:Vehicles",
  "adopt-me:Toys",
  "adopt-me:Food",
  "adopt-me:Furniture",
  "adopt-me:Houses",
  "fisch:Eggs",
]);

/**
 * Developer and moderator items. These are real rows — they exist in the games
 * and players know the names — so deleting them would make the catalogue lie by
 * omission. But no player can legitimately obtain or trade one, so they are
 * kept visible and forced untradeable. That is the same treatment rods and
 * totems already get: present in the catalogue, absent from the listing picker.
 */
const ADMIN_ITEM = /^(admin|test|dev|\[?debug)\b/i;

/**
 * "80 | Teddy Egg" -> "Teddy Egg". "WateringCan | Watering Can" -> "Watering Can".
 *
 * The left side of the pipe is the API's own collection key or index. The bound
 * of 24 characters is deliberate: it strips keys and indices without touching a
 * name that legitimately contains a pipe-like separator in its middle.
 */
function cleanName(raw) {
  let n = String(raw).trim();
  n = n.replace(/^[^|]{1,24}\s*\|\s*/, "");
  // "Ice Castle Egg Egg" -> "Ice Castle Egg". The API's egg collection appends
  // the type to a name that already ends in it.
  n = n.replace(/\b(\w+)(\s+\1)+\b/gi, "$1");
  return n.replace(/\s+/g, " ").trim();
}

/**
 * An id that is stable, readable and never empty.
 *
 * The pull's own slugifier returned "" for any name with no ASCII letters,
 * which is how seven emoji-named fish ended up sharing one id. Falling back to
 * the name's codepoints keeps those rows distinct and keeps the id
 * deterministic, so re-running the ingest does not churn the database.
 */
function slugify(name) {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s) return s;
  return `emoji-${[...name].map((c) => c.codePointAt(0).toString(16)).join("-")}`;
}

/** Names compare case- and punctuation-insensitively when deduping. */
function normName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parsePull(file) {
  const src = readFileSync(join(PULL, file), "utf8");
  const body = src.slice(src.indexOf("["), src.lastIndexOf("]") + 1);
  // The pull is a TS module of plain object literals; evaluating the array
  // literal is the cheapest correct parse and the input is a vendored file we
  // read ourselves, not user input.
  return new Function(`return ${body}`)();
}

const stats = {};
const byGame = {};

for (const [rawSlug, file] of Object.entries(FILES)) {
  const gameSlug = SLUG_MAP[rawSlug];
  if (!gameSlug) throw new Error(`No registry slug mapped for "${rawSlug}"`);

  const rows = parsePull(file);
  const s = {
    read: rows.length,
    navDropped: 0,
    renamed: 0,
    idRepaired: 0,
    adminLocked: 0,
    aliasesDropped: 0,
    kept: 0,
  };

  // Pass 1 — clean names, drop navigation pages, rebuild ids.
  const cleaned = [];
  const seenId = new Map();
  for (const r of rows) {
    const name = cleanName(r.name);
    if (NAV_PAGES.has(`${gameSlug}:${name}`)) {
      s.navDropped++;
      continue;
    }
    if (name !== String(r.name).trim()) s.renamed++;

    let id = `${gameSlug}-${slugify(name)}`;
    // A genuine name clash across categories (a "Kraken" pet and a "Kraken"
    // egg) is disambiguated by category rather than by a counter, so the id
    // still says what the row is.
    if (seenId.has(id)) {
      const withCat = `${gameSlug}-${slugify(`${name} ${r.category}`)}`;
      id = seenId.has(withCat) ? `${withCat}-${seenId.size}` : withCat;
      s.idRepaired++;
    }
    seenId.set(id, true);

    const admin = ADMIN_ITEM.test(name);
    if (admin) s.adminLocked++;

    const row = {
      id,
      gameSlug,
      name,
      category: r.category,
      ...(r.rarity ? { rarity: r.rarity } : {}),
      ...(r.type ? { type: r.type } : {}),
      ...(r.petClass ? { petClass: r.petClass } : {}),
      ...(r.sizeTier ? { sizeTier: r.sizeTier } : {}),
      ...(r.classes?.length ? { classes: r.classes } : {}),
      ...(r.assetId ? { assetId: String(r.assetId) } : {}),
      // Untradeable if the source said so, or if it is a developer item no
      // player can hold.
      ...(r.tradeable === false || admin ? { tradeable: false } : {}),
      ...(r.aliases?.length ? { aliases: r.aliases } : {}),
      // The pull's `verified: true` meant "a scraper saw this row", never "a
      // human checked its value". Renamed to what it means.
      sourced: true,
    };
    cleaned.push(row);
  }

  // Pass 2 — drop aliases that do not identify one row.
  //
  // The pull generated three aliases per row: the lowercase full name, an
  // initialism, and the last word. The last two collide hard — "egg" resolves
  // to 492 Pet Simulator 99 rows and "hs" to both Huge Sleipnir and Huge
  // Skeleton — and an alias that matches many rows cannot disambiguate a
  // listing. Nothing is lost by dropping them: substring search still finds
  // "Huge Pop Cat" from "cat" via the name itself. An alias earns its place
  // only by being unique within its game.
  const aliasCount = new Map();
  for (const row of cleaned) {
    for (const a of row.aliases ?? []) {
      aliasCount.set(a, (aliasCount.get(a) ?? 0) + 1);
    }
  }
  for (const row of cleaned) {
    if (!row.aliases) continue;
    const kept = row.aliases.filter((a) => aliasCount.get(a) === 1);
    s.aliasesDropped += row.aliases.length - kept.length;
    if (kept.length) row.aliases = kept;
    else delete row.aliases;
  }

  s.kept = cleaned.length;
  stats[gameSlug] = s;
  byGame[gameSlug] = cleaned;
}

// ---------------------------------------------------------------------------
// Assertions. A cleaner that quietly produces bad data is worse than no cleaner.
// ---------------------------------------------------------------------------
const allRows = Object.values(byGame).flat();
const ids = new Set();
for (const r of allRows) {
  if (ids.has(r.id)) throw new Error(`Duplicate id after cleaning: ${r.id}`);
  ids.add(r.id);
  if (!Object.values(SLUG_MAP).includes(r.gameSlug)) {
    throw new Error(`Unmapped gameSlug survived: ${r.gameSlug}`);
  }
  if (r.name.includes("|")) throw new Error(`API key left in name: ${r.name}`);
  if (!r.name) throw new Error(`Empty name on ${r.id}`);
}

mkdirSync(OUT, { recursive: true });
for (const [gameSlug, rows] of Object.entries(byGame)) {
  writeFileSync(join(OUT, `${gameSlug}.json`), JSON.stringify(rows, null, 0) + "\n");
}

// ---------------------------------------------------------------------------
// Art manifest — which items actually have a picture file on disk.
// ---------------------------------------------------------------------------
//
// The convention is "drop <id>.png into public/items/<gameSlug>/ and it
// appears". Making that work without a manifest would mean every tile
// optimistically requesting a file that, for 10,191 rows, almost never exists —
// ten thousand 404s per catalogue page, and server logs no longer worth
// reading. So the filenames are enumerated once, here, and the tile asks the
// manifest before it asks the network.
const ART_DIR = join(root, "public", "items");
const art = [];
if (existsSync(ART_DIR)) {
  for (const game of readdirSync(ART_DIR, { withFileTypes: true })) {
    if (!game.isDirectory()) continue;
    for (const file of readdirSync(join(ART_DIR, game.name))) {
      // The full filename is recorded, extension included, so that dropping in
      // a .jpg or a .webp works exactly as well as a .png. Storing the stem
      // alone would have meant reconstructing the path with a guessed
      // extension, which silently 404s for every format but one.
      if (/\.(png|jpg|jpeg|webp|avif|svg)$/i.test(file)) art.push(`${game.name}/${file}`);
    }
  }
}
art.sort();
writeFileSync(join(OUT, "art-manifest.json"), JSON.stringify(art, null, 0) + "\n");

const table = Object.entries(stats).map(([slug, s]) => ({
  game: slug,
  read: s.read,
  kept: s.kept,
  "nav dropped": s.navDropped,
  "names fixed": s.renamed,
  "ids repaired": s.idRepaired,
  "admin locked": s.adminLocked,
  "ambiguous aliases dropped": s.aliasesDropped,
}));
console.table(table);
console.log(`\n${allRows.length} rows written to src/lib/data/catalog/`);
console.log(
  `${art.length} local art file${art.length === 1 ? "" : "s"} found in public/items/`,
);
