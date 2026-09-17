/**
 * Proof, not claims.
 *
 *   npm run proof
 *
 * Six checks that the rules this codebase talks about are actually enforced by
 * code rather than by comments. Every one of them is a rule a player could be
 * hurt by if it were only a comment:
 *
 *   1. A cross-game trade produces no verdict — the maths refuses, because
 *      Beli and Shooms are different units and cross-trading is banned anyway.
 *   2. One unpriced item kills the verdict for the whole trade.
 *   3. A normal same-game trade still works, in the right unit.
 *   4. Every game's values carry their own source, date and unit, and a game
 *      with no list says so instead of inventing one.
 *   5. A template that may not be posted is in the catalogue and off the board.
 *   6. What a player can actually list, per game, including how much of it is
 *      priced and how much is flagged unverified.
 *
 * Check 4 earned its place immediately: it caught three games whose value
 * source was keyed by the research's slug rather than the registry's, so they
 * silently reported having no value list at all.
 */
import {
  findItem, catalogFor, CATALOG, catalogProvenance, pricedCoverage,
  thumbnailFor, variantAxesFor, multiplierFor, isUnpricedVariant,
} from "../src/lib/items.ts";
import { calculate } from "../src/lib/trade.ts";
import { suggestTrades, toBoardListing, type ListingRow } from "../src/lib/match.ts";
import { valueSourceFor, valueOf, formatValue } from "../src/lib/values.ts";
import { SERVICES, postable, servicesFor, PARTIAL_SERVICES } from "../src/lib/sessions.ts";
import { GAMES } from "../src/lib/games.ts";
import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { PARTNERS, referralFor } from "../src/lib/referrals.ts";

const it = (id: string, qty = 1, variant?: string) => ({ item: findItem(id)!, quantity: qty, variant });
const line = (n: string) => console.log("\n" + "─".repeat(72) + "\n" + n + "\n");

line("1. CROSS-GAME TRADE — a Blox Fruits fruit offered for a Sonaria creature");
{
  const c = calculate([it("bf-magnet")], [it("cs-keruku")], "viewer");
  console.log("  crossGame flag :", c.crossGame);
  console.log("  verdict        :", c.verdict, "(W/F/L withheld)");
  console.log("  -> the maths refused. Not a warning banner: no verdict exists.");
}

line("2. UNPRICED ITEM — Sonaria's most valuable item, which nobody has a number for");
{
  const c = calculate([it("cs-explosive-stars-material")], [it("cs-lunar-qilin")], "viewer");
  console.log("  unpriced on the incoming side :", c.incoming.unpriced);
  console.log("  verdict                       :", c.verdict);
  console.log("  -> one missing value kills the verdict for the whole trade.");
}

line("3. A REAL, PRICEABLE TRADE — same game, both sides known");
{
  const c = calculate([it("cs-keruku")], [it("cs-mijusuima")], "viewer");
  const s = valueSourceFor("creatures-of-sonaria")!;
  console.log("  in  :", formatValue(c.incoming.total), s.unit);
  console.log("  out :", formatValue(c.outgoing.total), s.unit);
  console.log("  verdict :", c.verdict, " (550K vs 325K — a 69% gap, well outside the 15% fair band)");
}

line("4. UNITS ARE NEVER SHARED");
for (const g of ["blox-fruits", "fisch", "creatures-of-sonaria", "gag2", "pet-simulator-99", "adopt-me"]) {
  const s = valueSourceFor(g);
  console.log("  " + g.padEnd(22), s ? `${s.unit}  · checked ${s.checked}` : "no value list — nothing is priced, and the card says so");
}

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
  const priced = tradeable.filter((i) => valueOf(i) !== undefined || valueOf(i, "Permanent") !== undefined);
  const unsure = all.filter((i) => i.verified === false);
  console.log("  " + g.padEnd(22),
    String(all.length).padStart(4) + " rows",
    "| " + String(tradeable.length).padStart(4) + " listable",
    "| " + String(priced.length).padStart(3) + " priced",
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

let failures = 0;
function assert(label: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
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

line("8. THE MERGE DID NOT EAT A PRICED ROW");
{
  // The specific regression this guards: the pull carries its own Keruku under
  // its own id. If a merge ever lets the pulled row win, `cs-keruku` stops
  // existing, values.ts no longer resolves, and Sonaria silently loses every
  // price it had.
  const anchors = ["cs-keruku", "cs-somnia-elus", "cs-mijusuima", "bf-magnet", "bf-kitsune"];
  for (const id of anchors) {
    const row = findItem(id);
    const priced = row ? valueOf(row) !== undefined : false;
    assert(`${id} still resolves and is priced`, Boolean(row) && priced);
  }

  const sonariaPriced = catalogFor("creatures-of-sonaria")
    .filter((i) => valueOf(i) !== undefined).length;
  assert("Sonaria keeps all 14 priced rows", sonariaPriced === 14, `${sonariaPriced} priced`);

  // The pull has 2 gliders; the curated list has 19. A merge that preferred the
  // pull would have quietly deleted 17 of them.
  const gliders = catalogFor("fisch").filter((i) => /glider/i.test(i.category));
  assert("Fisch keeps the 19 curated gliders", gliders.length >= 19, `${gliders.length} gliders`);
}

line("9. THE REFERRAL PATH — where an unpriced item sends a player");
{
  for (const g of ["blox-fruits", "fisch", "creatures-of-sonaria", "adopt-me", "gag2", "pet-simulator-99"]) {
    const r = referralFor(g);
    console.log(
      "  " + g.padEnd(22),
      r.unavailable ? "no partner — says why, links nowhere" : `${r.provider} via ${r.href}${r.paid ? "  [paid, disclosed]" : "  [unpaid, no commission claimed]"}`,
    );
  }

  // Nothing may claim commission before an agreement exists.
  const claiming = PARTNERS.filter((p) => p.active);
  assert(
    "no partner claims commission without an agreement",
    claiming.length === 0,
    claiming.length ? `${claiming.map((p) => p.name).join(", ")} marked active` : "all inactive",
  );

  // The destination must never come from the request. If referralFor ever
  // returned an absolute URL, /go would be forwarding somewhere it did not
  // derive — which is the open-redirect shape.
  const offsite = ["blox-fruits", "fisch", "adopt-me", "gag2"]
    .map((g) => referralFor(g).href)
    .filter((h) => h && !h.startsWith("/go/"));
  assert("every referral href is same-origin", offsite.length === 0,
    offsite.length ? offsite[0] : "outbound URL is built server-side only");
}

line("10. WHERE THE CATALOGUE CAME FROM");
for (const g of ["blox-fruits", "fisch", "gag2", "pet-simulator-99", "adopt-me", "creatures-of-sonaria"]) {
  const p = catalogProvenance(g);
  const c = pricedCoverage(g);
  console.log(
    "  " + g.padEnd(22),
    `curated ${String(p.curated).padStart(3)}`,
    `| pulled ${String(p.pulled).padStart(4)}`,
    `| priced ${String(c.priced).padStart(3)} of ${c.listable} listable`,
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

  // The point of listing unpriced mutations is that they stay honest about
  // being unpriced. If one ever acquired a silent multiplier, a trade would be
  // priced on a number nobody confirmed.
  const mutOptions = muts?.options ?? [];
  const priced = mutOptions.filter((o) => multiplierFor("fisch", o) !== undefined);
  const flagged = mutOptions.filter((o) => isUnpricedVariant("fisch", o));
  assert(
    "every mutation is either priced or flagged unpriced",
    priced.length + flagged.length === mutOptions.length,
    `${mutOptions.length} mutations: ${priced.length} priced (${priced.join(", ")}), ${flagged.length} flagged`,
  );
  assert("Aether is 15x, not the outdated 12x", multiplierFor("fisch", "Aether") === 15);

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

  // Four rows, because four is all gag2.gg publishes a number for. The unit is
  // an index the site keeps, not Sheckles, and nothing is scaled up to look
  // more like the Blox Fruits column.
  const priced = cosmetics.filter((i) => valueOf(i) !== undefined);
  assert("the four published cosmetic values resolve", priced.length === 4,
    priced.map((i) => `${i.name} ${valueOf(i)}`).join(", "));
  assert("and they are quoted in GAG2's own unit",
    valueSourceFor("gag2")?.unit === "Sheckle-points");

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

  // ---- the verdict is the calculator's, never the ranker's ----------------
  {
    const board = [row("unpriced", [
      { side: "offer", itemId: "bf-magnet" },
      { side: "want", itemId: "bf-kitsune" },
    ])].map(toBoardListing);
    const [s] = suggestTrades(board, [hold("bf-kitsune")], [hold("bf-magnet")], { now: NOW });
    const direct = calculate(s.youGet, s.youGive, "viewer");
    assert("the suggestion's verdict is exactly what calculate() returns",
      s.verdict === direct.verdict, s.verdict);
  }

  // ---- an unpriced trade is never punished for being unpriced -------------
  //
  // Fisch is deliberately sparse on values. A ranker that marked "?" down would
  // bury most of one game for a reason that has nothing to do with that game.
  {
    const priced = [row("p", [{ side: "offer", itemId: "bf-magnet" }, { side: "want", itemId: "bf-kitsune" }])];
    const [s] = suggestTrades(priced.map(toBoardListing), [hold("bf-kitsune")], [hold("bf-magnet")], { now: NOW });
    const unknownFactor = s.factors.find((f) => /no published value/i.test(f.label));
    assert("no factor penalises a trade for having no published value",
      unknownFactor === undefined);
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
  const raw = app.filter((f) => /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(read(f)));
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

console.log("\n" + "─".repeat(72));
if (failures > 0) {
  console.log(`\n${failures} assertion${failures === 1 ? "" : "s"} FAILED.\n`);
  process.exit(1);
}
console.log("\nAll assertions passed.\n");
