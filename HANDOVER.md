> **This file is a historical brief, kept for context. It is not current.**
> For how to actually set the site up and run it, read `START-HERE.md`.
> Two things in here are out of date on purpose: MintPlaza no longer keeps
> values or a W/F/L calculator (see `src/lib/referrals.ts`), and messaging is
> built rather than planned.

# Brief for the brainstorming session

Copy everything below the line into Claude and attach `mintplaza.zip`.

---

You are picking up a real, live project mid-build. Read this whole brief before
answering. The attached zip is the actual working codebase — open it and read
the files in §3 before researching anything.

**Read §7 before you trust a single fact in this brief about Fisch.** A large
part of what follows is second-hand and may be wrong.

## 1. What MintPlaza is

A matching site for Roblox players. Not a wiki, not a value list, not a Discord
replacement. Its one job, and the line every decision is measured against:

> **Help the user find the right existing opportunity before encouraging them to
> create more spam.**

Every game has three boards inside an Explore tab:

| Board | `kind` | What it is |
| --- | --- | --- |
| **Trade & Offers** | `trades` | I have X, I want Y. |
| **Raids & Services** | `services` | I am stuck; **one or two** people can unstick me. |
| **Help & Recruitment** | `recruit` | Nobody is stuck — the content will not *start* with fewer than 3. |

The services/recruitment split is not about difficulty. It is: *is somebody
stuck, or does the game simply refuse to begin?* Get that wrong and the two
boards become one board.

**Post lifetimes are chosen by the poster**, not by us — this changed recently,
so ignore any older description. Services offer 30m / 1h / 2h / 4h; crews offer
15m / 30m / 40m / 1h / 2h. The database bounds it at 10 minutes to 4 hours
either way. Posters on those two boards also set a **vote cap** and **how many
they will pick**, which is shown on the card. Trades has none of that — one
person to one person, so there is nothing to cap and no team to size.

Also live: Contacts (only people you finished a deal with — no stranger can ever
be added), My lists, an owner-only admin panel, Roblox OAuth, a player-reports
queue, per-game tab renaming.

## 2. Your job

**Blox Fruits is done.** Verified counts as of this zip: **86 catalogue rows,
23 services templates, 15 recruitment templates** (9 with real artwork), live
database. It took six days, four of which were building the *system*. The system
exists now.

**The owner is leaning towards Fisch as game #2.** He is not certain, and he
would rather you check than agree. If your research says a different game is a
better fit, **say so and argue for it** — that is more useful than a confident
Fisch pack built on a wrong premise.

**Deliverable: one Markdown file** a coding agent can implement without
follow-up questions. For whichever game you land on:

1. **The catalogue** — every tradeable item, in the exact `CatalogItem` shape in
   §4. Blox Fruits has 86 rows across fruits, gamepasses, scrolls and 35 skins.
   Match that depth or say honestly why the game cannot support it.
2. **The variant axis.** Blox Fruits uses `["Permanent", "Physical"]` — one item
   with two forms rather than two rows. Decide the equivalent for your game and
   **justify it in a paragraph.** This is the most consequential call you make.
3. **Services templates** (≤3 players total) in the `Service` shape.
4. **Recruitment templates** (≥3 players), with the game's own crew size where
   the game states one.
5. **Reference pictures** — where one template means different jobs depending on
   a detail (Blox Fruits: which race, which katana), list the options.
6. **An image shopping list**, priority order, required vs optional. The owner
   screenshots these by hand and it is the real bottleneck.
7. **`Game` registry entry.**
8. **Sources and confidence.** Every non-obvious fact gets a URL. Anything you
   could not confirm is `verified: false` — never guessed.

## 3. Read these first

Short files, heavily commented, and the comments explain *why* — which is the
part you need.

| File | What it tells you |
| --- | --- |
| `src/lib/items.ts` | The catalogue, `CatalogItem`, `Rarity`, `ITEM_VARIANTS` |
| `src/lib/sessions.ts` | `Service`, `ServiceKind`, `Section`, both boards, the window rules |
| `src/lib/values.ts` | Price vs Value vs Demand, and why they are three things |
| `src/lib/games.ts` | The `Game` registry every game plugs into |
| `src/lib/profile.ts` | Profiles, proof screenshots, and the long note on why the word "verified" is never used |

Then `src/lib/trade.ts` (the W/F/L calculator) and `src/lib/contacts.ts` (why
contacts work the way they do).

## 4. The exact shapes

Emit real TypeScript, not prose about it.

```ts
type Rarity = "Common" | "Uncommon" | "Rare" | "Ultra-Rare"
            | "Legendary" | "Mythical" | "Premium";

interface CatalogItem {
  id: string;            // "<game>-<kebab-name>", unique across the whole file
  gameSlug: string;
  name: string;
  category: string;      // the game's own word: "Fish", "Rod", "Vessel", ...
  rarity?: Rarity;       // omit if unconfirmed — never guess a tier
  type?: string;         // secondary classification
  art?: string;          // "/art/items/<game>/<file>.jpg" — omit if no image
  formerly?: readonly string[];   // real renames, shown as "WAS X"
  aliases?: readonly string[];    // nicknames, searchable only, never displayed
  parentId?: string;              // a skin points at what it repaints
  tradeable?: boolean;            // false = never appears in a listing picker
  robux?: number;                 // PRICE, not value
  note?: string;
  verified?: boolean;             // false = flagged in admin for checking
  checkedAt?: string;             // set by the panel, not by you
}

type Section = "services" | "recruit";
type ServiceKind = "Raid" | "Trial" | "Puzzle" | "Boss" | "Unlock"
                 | "Grind" | "Island" | "Crew" | "Event" | "Hunt";

interface Service {
  id: string;            // "<game>-s-*" services, "<game>-r-*" recruitment
  gameSlug: string;
  name: string;
  kind: ServiceKind;
  section?: Section;     // omit for services; "recruit" for crews
  art?: string;
  needs?: string;        // the GAME's requirement, not ours. One sentence.
  players?: number;      // total incl. the asker. services ≤3, recruit ≥3
  gives?: string;
  openEnded?: boolean;   // poster fills in the specifics
  refs?: { id: string; label: string; hue?: string; art?: string }[];
  aliases?: readonly string[];
  verified?: boolean;
}

interface Game {
  slug: string; name: string; shortName: string; blurb: string;
  modules: ("trades"|"inventory"|"activities"|"help"|"services")[];
  wants: { label: string; kind: "trade"|"group"|"help"|"check"; detail?: string }[];
  exploreTabs: { id: string; label: string; blurb: string;
                 kind: "trades"|"services"|"community" }[];
  exploreHighlights: string[];
  activityKinds: string[];
  itemCategories: string[];
  itemAttributes: { key: string; label: string; options?: string[] }[];
  tradeGate?: string;
  hue: string;
  art: string;
  sourceNote: string;    // where this came from and when
}
```

`ServiceKind` and the three tab `kind`s are the parts you may not invent — each
maps to code that exists. If your game genuinely needs a kind that is not there,
say so and make the case; do not quietly add one.

Post lifetime, vote cap and slots are properties of a *listing*, not a template,
so they are not your problem. Just know they exist.

## 5. Rules you must not break

**Product**
- No real-money sales. No cross-trading between games. No account sharing or
  "pilot" services — a run done on somebody's account is not a service.
- Never ask for a password, cookie or session token, anywhere.
- No fake data, no fake verification badges. Audience is 13+. This is not a
  style preference: players post screenshots of their in-game profile to a
  **Proofs** section, MintPlaza cannot check a screenshot, and the interface
  therefore says "3 pictures shown — MintPlaza has not checked these" rather
  than issuing a tick. If you propose anything that reads as an endorsement of
  an unchecked claim, it will be cut.
- No middleman or escrow. MintPlaza never holds anybody's items.

**Data**
- **Missing beats invented.** An absent value makes the calculator say "cannot
  price this side", which is honest. A guessed one lies with confidence.
- One source per number, stamped with the date read. Value sites disagree by 2×
  on the same item on the same day; mixing them gives a calculator whose two
  sides use different rulers.
- Price ≠ Value. Portal costs 1.9M Beli and trades near 10M.
- Demand is six words, never a score: Very low, Low, Mid, High, Very high,
  **Extreme**.
- The verdict is **W, F or L and nothing else.** No percentage, no margin.
  Within ±15% is Fair. The owner removed the score deliberately.

**Boards**
- Services ≤3 players. Recruitment ≥3. Never both.
- Recruitment posts are one direction — somebody starts a crew, others join by
  voting. There is no "I'll join" post; it describes nothing actionable.
- If a thing can be soloed, it is not a service.

**Profiles**
- A profile is two halves and they never blur: what the player typed
  (description, tags, screenshots — evidence of nothing) and what the site
  counted (deals done, lists posted, contacts, which lists they keep coming
  back to — incremented by database triggers, untypable by anyone).
- Those counters are real tables, not `count(*)` queries, because listings are
  hard-deleted when their window closes. A career total computed from live rows
  is a lie that gets worse every day.
- Proofs are per game, stored in a private-by-path bucket, three asked for and
  six allowed. Game tags reuse each game's own cover art, so **a game you add
  to the registry becomes a profile tag for free** — you do not need to design
  that part.
- There is no username search anywhere on the site. A profile is reached from a
  voter list, a contact or a comment. Do not propose a people-search.

Everything above is settled. **Everything below is not.**

## 6. Where you should push back

Do not treat these as decided. If the research says otherwise, say so:

- **Whether Fisch is the right second game at all.**
- **Whether three boards fit it.** The `Game` registry already allows a
  different `exploreTabs` set per game. If your game needs two, or four, design
  it and argue for it.
- **The ≤3 / ≥3 split.** It came from Blox Fruits and might not transfer.
- **Which game should be #3.** The owner's instinct is to weigh *"do players
  there already need each other"* above raw player count. Challenge that if you
  disagree.
- **Anything in §1–§5 that is wrong for your game.**

## 7. What I could not verify, and why you should distrust it

I am the coding agent that built Blox Fruits. My sandbox **cannot reach
fandom.com, fischipedia.org, Traderie, Game.Guide or any value site** — the
network blocks them. Everything I "know" about Fisch came from *search-result
summaries*, not from reading a single page.

So treat this entire section as **rumour to be confirmed or thrown away.** You
have real search. Use it. If a line here is wrong, say so plainly in your file —
that correction is worth more to the project than agreement.

Reported, unverified:

- Two trading routes in-game: Direct Trading and a Trade Plaza. Tradeable
  reported as fish, rod skins, vessels, bobbers.
- Mutations reported to multiply sell value: Aether 12×, Tryhard 10×, Prismic
  8×, Glowy 8×. **The multipliers, the names and the full list are all
  unconfirmed.** They also reportedly change between updates.
- "Puff of Heaven" reported as most valuable; Evangeline, Nocturne and Curse IV
  as high demand. Unconfirmed, and value rankings rot fast.
- Megalodon Hunt: Ancient Isle, ~15 minutes, ends when one is caught. Progress
  penalties reported around −80% / −85%. Sundial Totems reportedly speed it.
- Kraken Hunt: Atlantis, similar mechanics, reportedly **only one player can
  catch it**. A 3-player team reported as the best earner. Unconfirmed.
- Ancient Kraken Hunt: reportedly triggered by a Poseidon's Wrath Totem, ~6
  minutes.
- Fisch appears to have two wikis — `fischipedia.org` (looks official) and
  `fisch.fandom.com`. I could open neither. **Check which is current, say which
  you used, and note where they disagree.**

If those mechanics *are* roughly right, note the shape: timed windows, small
crews, one-winner races, an item-holder who triggers the event. That is the same
shape as Blox Fruits' Leviathan and Kitsune Island, which is why Fisch was
suggested. **If the shape turns out to be different, that is a finding, not a
failure — report it.**

One concrete thing to check: a ~6-minute event is shorter than the shortest
window the post form currently offers (15 minutes). If real, flag whether the
form needs a shorter option.

Player counts I have seen quoted, also from summaries and also unverified: Grow
a Garden 2 ~508K concurrent, Adopt Me 315–531K, Steal a Brainrot ~154K with a
25.8M peak. Re-check before relying on any of it.

## 8. How to research

**Sources in order:** the game's own wiki, read properly — its actual tables,
not a summary of a summary. Then value sites for numbers. Then guides, only to
corroborate.

**Where sources conflict, say so and lead with what nobody disputes.** Real
example from this project: Kitsune Island is documented as needing both a Full
Moon and a Blue Moon, so the card leads with Sea Danger Level 6 — which every
source agrees on — and leaves the moon out of the requirement.

**Five mistakes this project actually made. Do not repeat them:**

1. Skins were invented from forum posts. They did not exist.
2. CHROMATIC was modelled as a rarity. It sits *beside* the rarity.
3. "Saber V3" was added. It is a fan concept, not in the game.
4. Dough King and Cake Prince were nearly swapped — both are a character with a
   trident on a purple background. Check twice on lookalikes.
5. Dragon was one item. It is **two** — West and East trade separately, and so
   do their Permanent forms.

## 9. Output format

1. **Decisions and reasoning** — including anything in this brief you think is
   wrong. Lead with it; it is the most valuable part.
2. **Corrections to §7** — what I got wrong, with sources.
3. **Catalogue** — TypeScript, ready to paste.
4. **Services templates.**
5. **Recruitment templates.**
6. **`Game` registry entry.**
7. **Image shopping list** — priority order, required vs optional.
8. **Open questions**, with what would resolve each. A short honest list beats a
   padded one.
9. **Game #3 recommendation**, with the research behind it.
10. **Sources.**

## 10. Finally

Do not soften findings, and do not agree with this brief to be agreeable. If the
catalogue cannot reach 80 rows without guessing, give the real number. If the
variant idea does not survive the wiki, say so and propose better. If Fisch is
the wrong game, say that first.

The owner cannot read code. Write the reasoning so someone who has never seen
TypeScript understands *why*, and keep the code blocks clean enough to paste.
