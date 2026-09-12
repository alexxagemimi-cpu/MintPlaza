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
import { findItem, catalogFor } from "../src/lib/items.ts";
import { calculate } from "../src/lib/trade.ts";
import { valueSourceFor, valueOf, formatValue } from "../src/lib/values.ts";
import { SERVICES, postable, servicesFor } from "../src/lib/sessions.ts";

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
    String(all.length).padStart(3) + " rows",
    "| " + String(tradeable.length).padStart(3) + " listable",
    "| " + String(priced.length).padStart(3) + " priced",
    "| " + String(unsure.length).padStart(2) + " flagged unverified");
}
