# Brief for the brainstorming session

Copy everything below the line into Claude and attach `mintplaza.zip`.

---

You are picking up a real, live project mid-build. Read this whole brief before
answering anything. The zip attached is the actual working codebase — open it
and read the four files named in §3 before you research a single thing.

## 1. What MintPlaza is

A matching site for Roblox players. Not a wiki, not a value list, not a Discord
replacement. Its one job, and the line every decision is measured against:

> **Help the user find the right existing opportunity before encouraging them to
> create more spam.**

Every game on the site has exactly three boards inside an Explore tab:

| Board | `kind` | What it is | Post lives for |
| --- | --- | --- | --- |
| **Trade & Offers** | `trades` | I have X, I want Y. Carries a W/F/L calculator. | 2 hours |
| **Raids & Services** | `services` | I am stuck; **one or two** people can unstick me. | 2 hours |
| **Help & Recruitment** | `recruit` | Nobody is stuck — the content will not *start* with fewer than 3. | **40 minutes** |

The services/recruitment split is not about difficulty. It is: *is somebody
stuck, or does the game simply refuse to begin?* Get that wrong and the boards
become the same board.

Also live: Contacts (people you finished a deal with — no stranger can ever be
added), My lists, an owner-only admin panel, Roblox OAuth sign-in.

## 2. Your job, and the only thing that counts as done

**Blox Fruits is finished** — 86 catalogue rows, 23 services templates, 15
recruitment templates, real artwork, live database. It took six days, but four
of those were building the *system*. The system now exists. Nothing about it
needs redesigning.

**Fisch is confirmed as game #2.** That decision is made; do not re-litigate it.

You have **5 hours**. Produce a research pack that a coding agent can implement
in **two days without asking a single follow-up question**. That is the bar. If
the coding agent has to stop and ask "what rarity is a Megalodon", you failed.

**Deliverable: one Markdown file** containing, for Fisch first and then for each
other game you recommend:

1. **The catalogue** — every tradeable item, in the exact `CatalogItem` shape in
   §4. Blox Fruits has 86 rows spanning fruits, gamepasses, scrolls and 35
   skins. **Fisch must be comparably deep** — fish, rods, rod skins, vessels,
   bobbers, totems, enchants. A thin catalogue makes the whole game look
   abandoned. Aim for 80+ rows and say so honestly if a category is short.
2. **The variant axis.** Blox Fruits uses `["Permanent", "Physical"]`. Fisch's
   equivalent is its **mutations** (Aether 12×, Tryhard 10×, Prismic 8×, Glowy
   8× — verify these, they move). Decide whether mutations are variants, a
   `type`, or separate rows, and **justify it in one paragraph.** This is the
   single most consequential call you will make.
3. **Services templates** (1–2 helpers) in the exact `Service` shape in §4.
4. **Recruitment templates** (3+ players) in the same shape, each with a
   `players` count that is the game's own number where the game states one.
5. **Reference pictures** — where one template means different jobs depending on
   a detail (Blox Fruits: which race, which katana), list the options.
6. **An image shopping list** — the exact screenshots the owner must supply,
   named, in priority order. He supplies these by hand; it is the real
   bottleneck, so keep the list tight and say which are optional.
7. **`Game` registry entry** in the shape in §4.
8. **Sources and confidence.** Every non-obvious fact gets a URL. Anything you
   could not confirm is marked `verified: false` — **never** guessed.

## 3. Read these four files first

Do not design anything before reading them. They are short and heavily
commented, and the comments explain *why*, which is what you need.

| File | What it tells you |
| --- | --- |
| `src/lib/items.ts` | The catalogue, `CatalogItem`, `Rarity`, `ITEM_VARIANTS` |
| `src/lib/sessions.ts` | `Service`, `ServiceKind`, `Section`, both boards, the window rules |
| `src/lib/values.ts` | Price vs Value vs Demand, and why they are three things |
| `src/lib/games.ts` | The `Game` registry every game plugs into |

Also worth reading: `src/lib/trade.ts` (the W/F/L calculator) and
`src/lib/contacts.ts` (why contacts work the way they do).

## 4. The exact shapes to fill in

Emit real TypeScript in these shapes, not prose descriptions of them.

```ts
type Rarity = "Common" | "Uncommon" | "Rare" | "Ultra-Rare"
            | "Legendary" | "Mythical" | "Premium";

interface CatalogItem {
  id: string;            // "fisch-<kebab-name>", unique across the whole file
  gameSlug: string;      // "fisch"
  name: string;
  category: string;      // "Fish" | "Rod" | "Vessel" | "Bobber" | "Totem" | ...
  rarity?: Rarity;       // omit if unconfirmed — never guess a tier
  type?: string;         // secondary classification, game's own word
  art?: string;          // "/art/items/fisch/<file>.jpg" — leave out if no image
  formerly?: readonly string[];   // real renames, shown as "WAS X"
  aliases?: readonly string[];    // nicknames, searchable only, never displayed
  parentId?: string;              // a skin points at what it repaints
  tradeable?: boolean;            // false = never appears in a listing picker
  robux?: number;                 // PRICE, not value
  note?: string;
  verified?: boolean;             // false = flagged in admin for checking
}

type Section = "services" | "recruit";
type ServiceKind = "Raid" | "Trial" | "Puzzle" | "Boss" | "Unlock"
                 | "Grind" | "Island" | "Crew" | "Event" | "Hunt";

interface Service {
  id: string;            // "fisch-s-*" for services, "fisch-r-*" for recruitment
  gameSlug: string;
  name: string;
  kind: ServiceKind;
  section?: Section;     // omit for services; "recruit" for crews
  art?: string;
  needs?: string;        // the GAME's requirement, not ours. One sentence.
  players?: number;      // total incl. the person asking. services ≤3, recruit ≥3
  gives?: string;        // what they walk away with
  openEnded?: boolean;   // true where the poster fills in the specifics
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
  tradeGate?: string;    // in-game gate on trading at all, if one exists
  hue: string;           // hex, sets the game's accent
  art: string;
  sourceNote: string;    // where this came from and when
}
```

## 5. Rules you must not break

These are settled. Anything violating one is unusable.

**Product**
- No real-money sales. No cross-trading between games. No account sharing or
  "pilot" services — a run done on somebody's account is not a service.
- Never ask for a password, cookie or session token. Nothing anywhere.
- No fake data, no fake verification badges. Audience is 13+ (Roblox OAuth
  enforces it), so nothing that helps an adult message a child.
- No middleman or escrow. MintPlaza never holds anybody's items.

**Data**
- **Missing beats invented.** An absent value makes the calculator say "cannot
  price this side", which is honest. A guessed one makes it lie with confidence.
- One source per number, stamped with the date read. Value sites disagree by
  2× on the same item on the same day; mixing them gives a calculator whose two
  sides use different rulers.
- Price ≠ Value. Portal costs 1.9M Beli and trades at ~10M. Never conflate them.
- Demand is six words, never a score: Very low, Low, Mid, High, Very high,
  **Extreme** (drawn in red).
- The trade verdict is **W, F or L and nothing else**. No percentage, no margin.
  Within ±15% is Fair. The owner removed the score deliberately — do not
  reintroduce it in any form.

**Boards**
- Services ≤ 3 players total. Recruitment ≥ 3. Never both boards.
- Recruitment posts are **one direction only** — somebody starts a crew, others
  join by voting. There is no "I'll join" post; it describes nothing actionable.
- If a thing can be soloed, it is not a service. Blox Fruits' Captain Elephant
  was cut for exactly this.

## 6. How to research, and how not to

**Sources, in order:** the game's own wiki (Fisch has two — `fischipedia.org`
is the official one, `fisch.fandom.com` the Fandom one; they disagree, say
which you used). Then Traderie and Game.Guide for values. Then guides, only to
corroborate.

**Read the wiki properly.** Not a summary of a summary. The Blox Fruits data is
good because it came off the wiki's own tables — rarity from the tile border,
prices from the price column. Do the same.

**Where sources conflict, say so and pick the one nobody disputes.** Real
example from this project: Kitsune Island is documented as needing both a Full
Moon and a Blue Moon, so the card leads with Sea Danger Level 6 — which every
source agrees on — and leaves the moon out of the requirement line.

**Things that burned us, so you don't repeat them:**
- Skins were invented from forum posts. They didn't exist. Only the wiki counts.
- CHROMATIC was modelled as a rarity. It sits *beside* the rarity.
- "Saber V3" was added. It does not exist — it is a fan concept.
- Dough King and Cake Prince were nearly swapped. Both are a character with a
  trident on a purple background. Check twice on lookalikes.
- Dragon was one item. It is **two** — West and East trade separately, and so do
  their Permanent forms.

## 7. What is already known about Fisch — verify all of it

Starting points, not conclusions. Confirm every line.

- Two trading routes in-game: Direct Trading and the Trade Plaza. Tradeable:
  **fish, rod skins, vessels, bobbers.**
- Mutations multiply sell value: **Aether 12×, Tryhard 10× (100% from the
  Tryhard Rod), Prismic 8× (50% from the Ethereal Prism Rod), Glowy 8×.** Verify the numbers and find the full list.
- Most valuable item reported as **Puff of Heaven**; high demand on
  **Evangeline, Nocturne, Curse IV**. Verify.
- **Megalodon Hunt** — Ancient Isle, 15 minutes, ends the moment one is caught.
  Normal and Ancient carry −80% progress speed, Phantom −85%. Sundial Totems
  speed the day to spawn it.
- **Kraken Hunt** — Atlantis, same mechanics. **Only one player can catch it**,
  so you race the whole server. A coordinated **3-player team** makes it the
  best per-hour earner because the loot includes Ancient Coins.
- **Ancient Kraken Hunt** — Poseidon's Wrath Totem during a Kraken Hunt.
  **6 minutes.**

Note the shape: timed windows, crews of three, one-winner races, totem holders.
That is the same shape as Blox Fruits' Leviathan and Kitsune Island, which is
why Fisch was chosen. **The 6-minute Ancient Kraken window is shorter than the
40-minute recruitment clock — flag whether that needs a per-template override.**

## 8. Also decide, and argue for

- **Which game is #3.** Researched positions, not vibes. Known: Grow a Garden 2
  ~508K concurrent, Adopt Me 315–531K, Steal a Brainrot ~154K (25.8M peak).
  Adopt Me has the biggest trading culture but almost no team content — it would
  fill one board of three. Weigh *"do players there already need each other"*
  above raw player count, and say if you disagree with that weighting.
- **Whether Fisch needs a fourth board or a different tab set.** The three are
  not sacred; the `Game` registry already allows different `exploreTabs`. If
  Fisch genuinely needs something else, say so and design it.
- **What breaks at 6 games.** Search across catalogues, one board per game vs
  shared, whether recruitment fragments the player pool. Be specific.

## 9. Output format

One Markdown file, in this order:

1. **Decisions and reasoning** — the mutation call, board mapping, anything you
   disagree with in this brief. Lead with it; it is the most valuable part.
2. **Fisch catalogue** — TypeScript array, ready to paste.
3. **Fisch services templates** — TypeScript array.
4. **Fisch recruitment templates** — TypeScript array.
5. **Fisch `Game` registry entry** — TypeScript object.
6. **Image shopping list** — table, priority order, marked required/optional.
7. **Open questions** — anything you could not resolve, with what would resolve
   it. An honest short list beats a padded long one.
8. **Game #3 recommendation** — with the research behind it.
9. **Sources** — every URL used.

## 10. Finally

Do not soften findings. If Fisch's catalogue cannot reach 80 rows without
guessing, say so and give the real number. If the mutation-as-variant idea
doesn't survive contact with the wiki, say that and propose better. If part of
this brief is wrong, say which part.

The owner cannot read code. Write the reasoning so a person who has never seen
TypeScript understands *why*, and keep the code blocks clean enough that an
agent can paste them.
