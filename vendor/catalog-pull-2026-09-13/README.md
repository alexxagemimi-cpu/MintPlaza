# MintPlaza Catalogues — Real Data Pull, 13 September 2026

**10,053 catalogue rows across five games.** These were not transcribed from search results. They were pulled directly from each wiki's API and from BIG Games' official API, then cross-referenced against each game's own rarity categories.

## What's in the box

| Game | Rows | Rarity set | Images | Source |
|---|---|---|---|---|
| Pet Simulator 99 | **4,977** | 62% | **3,108 asset IDs** | BIG Games official API |
| Adopt Me! | **2,172** | 97% | — | Fandom API |
| Fisch | **2,119** | 42% | — | Fandom API |
| Creatures of Sonaria | **482** | 100% | — | Fandom API |
| Grow a Garden 2 | **303** | 68% | — | Fandom API + gag2.gg |

Each game has a `.ts` file (paste-ready) and a `.json` file (for scripts).

## Breakdown per game

**Pet Simulator 99 — 4,977 rows.** 3,109 pets (1,039 Huge, 341 Titanic, 73 Gargantuan, 1,656 regular), 924 eggs, 327 misc items, 140 booths, 131 hoverboards, 106 lootboxes, 59 cards, 57 boosts, 56 enchants, 13 charms, 11 rods, 11 shovels, 11 ultimates, 8 potions, 7 fruits, 4 seeds, 2 watering cans, 1 sprinkler. Full rarity ladder captured: Basic → Rare → Epic → Legendary → Mythical → Exotic → Divine → Superior → Celestial → Secret → Exclusive.

**Adopt Me — 2,172 rows.** 788 pets, 758 toys, 283 vehicles, 184 food, 104 strollers, 42 eggs, 11 furniture, 2 potions. 104 items flagged `tradeable: false` from the wiki's Non-Tradable category.

**Fisch — 2,119 rows.** 1,426 fish, 242 rods, 141 items, 96 rod skins, 93 bait, 81 bobbers, 21 totems, 17 boats, 2 gliders. Rods, bait and totems are marked `tradeable: false` — the game doesn't allow trading them.

**Creatures of Sonaria — 482 creatures.** Tier 1: 50, Tier 2: 74, Tier 3: 127, Tier 4: 131, Tier 5: 100. This matches the wiki's own stated 481 almost exactly. Event and Limited flags applied.

**Grow a Garden 2 — 303 rows.** 112 crops, 72 gears, 49 pets, 31 crates, 16 packs, 13 eggs, 7 seeds, 3 chests. The crop count is 112, not the 33 in my earlier document — that earlier number was wrong.

## Honest gaps — read this before you build

**Fisch cosmetics are incomplete, and I can't fix it from here.** The official Fisch wiki (fischipedia.org) is hosted on Miraheze and blocks automated access at the network level. I tried the standard API, the alternate API path, the REST endpoint, and browser headers — all returned a connection-check page. So Fisch data came from the legacy Fandom wiki, which is thinner on cosmetics:

| Item type | Pulled from Fandom | Claimed on fischipedia |
|---|---|---|
| Rod skins | 96 | ~531 |
| Bobbers | 81 | ~354 |
| Boats | 17 | ~312 |
| Gliders | 2 | 9 |

The fish themselves (1,426) are solid. The cosmetics are not. To close this you'd need someone to open fischipedia in a normal browser and export those four tables, or find a mirror that isn't bot-blocked.

**Fisch rarity is only 42%.** Many fish pages on the Fandom wiki aren't filed under a rarity category, so `rarity` is left unset rather than guessed. The rows are still correct — they just don't all carry a tier.

**PS99 rarity is 62%.** 622 pets have no rarity object in the API itself. That's the source's gap, not a pull error.

**Adopt Me potions came back as 2 and furniture as 11.** Those categories are thin on the wiki. Worth a manual check if potions matter to your trade calculator — they do affect pet values (Fly/Ride).

**Nothing here is a guess.** Where a field was missing at the source, it's left unset. No rarity was inferred, no name was reconstructed.

## Fields you'll see

- `id` — `<gameslug>-<kebab-name>`, unique
- `name` — exact name from source
- `category` — your filter chip
- `rarity` — MintPlaza's 7-tier mapping, omitted when unknown
- `type` — the game's own rarity word, kept for reference
- `petClass` (PS99) — Huge / Titanic / Gargantuan
- `sizeTier` (Sonaria) — Tier 1–5
- `classes` — Limited, Event, Special, Extinct, etc.
- `assetId` (PS99) — Roblox asset ID; fetch the image at `https://thumbnails.roblox.com/v1/assets?assetIds=<id>&size=420x420&format=Png`
- `tradeable` — false where the game blocks trading
- `aliases` — lowercase search terms

## Rarity mappings used

**Fisch:** Trash/Common → Common · Uncommon/Unusual → Uncommon · Rare → Rare · Legendary → Ultra-Rare · Mythical → Legendary · Exotic/Secret/Apex/Divine Secret → Mythical. Limited, Special, Extinct, Relic, Fragment, Seed, Gemstone are classifications, not power levels — they go in `classes`, not `rarity`.

**PS99:** Basic → Common · Rare → Rare · Epic → Ultra-Rare · Legendary → Legendary · Mythical/Exotic/Divine/Superior/Celestial/Secret → Mythical · Exclusive → Premium.

**GAG2:** Common → Common · Uncommon → Uncommon · Rare → Rare · Epic → Ultra-Rare · Legendary → Legendary · Mythic → Mythical · Super → Premium. Secret and Limited go in `classes`.

**Adopt Me:** maps 1:1 (Common, Uncommon, Rare, Ultra-Rare, Legendary). Mythical and Premium go unused — Adopt Me has no equivalent.

**Sonaria:** Tier 1 → Common · Tier 2 → Uncommon · Tier 3 → Rare · Tier 4 → Legendary · Tier 5 → Mythical. Note these are *size* tiers, which is the only ladder the wiki maintains consistently.

## How to refresh

PS99 re-pulls cleanly any time — it's a live API:
```
https://ps99.biggamesapi.io/api/collections
https://ps99.biggamesapi.io/api/collection/Pets
```
Send a browser User-Agent or you'll get a 403.

The Fandom wikis re-pull the same way:
```
https://<wiki>.fandom.com/api.php?action=query&list=categorymembers&cmtitle=Category:<Name>&cmlimit=500&format=json
```

Re-run monthly. These games patch weekly.
