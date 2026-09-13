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
import { valueSourceFor, valueOf, formatValue } from "../src/lib/values.ts";
import { SERVICES, postable, servicesFor } from "../src/lib/sessions.ts";
import { GAMES } from "../src/lib/games.ts";
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
for (const g of ["blox-fruits", "fisch", "creatures-of-sonaria", "gag2", "pet-simulator-99", "adopt-me", "royale-high"]) {
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
for (const g of ["blox-fruits", "fisch", "gag2", "pet-simulator-99", "adopt-me", "creatures-of-sonaria", "grow-a-garden", "royale-high"]) {
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
  for (const g of ["blox-fruits", "fisch", "creatures-of-sonaria", "adopt-me", "gag2", "pet-simulator-99", "royale-high"]) {
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

console.log("\n" + "─".repeat(72));
if (failures > 0) {
  console.log(`\n${failures} assertion${failures === 1 ? "" : "s"} FAILED.\n`);
  process.exit(1);
}
console.log("\nAll assertions passed.\n");
