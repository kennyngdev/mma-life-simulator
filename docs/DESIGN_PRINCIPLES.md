# Design principles

## Player experiment

The player begins as an ordinary late-Ming youth and discovers what kind of martial life this imperfect person builds through repeated commitments. A run asks, “When the same kinds of pressure return with greater stakes, what do you keep choosing?”

The loop is:

> survive three youth turns with novice moves → choose a desired sect → earn admission → mutate the sect style at three milestones → reach a path-sensitive ending

## Whole-life structure

- A life lasts at most sixteen displayed turns across 少年、入門、闖蕩、成名、晚年. Each phase changes the social pressure, not only enemy numbers.
- The opening crossroads awards two points to 問劍、行契、or 守人. Every later event offers one method for each path and awards one point. The highest score routes the next event; the most recently chosen path breaks ties.
- The campaign contains one shared crossroads and one authored event variant for each dominant path on turns 2–16: 46 event definitions total. Choices must change objective rules, access, relationships, money, or path direction.
- Money is useful only inside events. It purchases information, allies, fewer enemies, fewer objective steps, alternate routes, or a peaceful resolution. There is no standalone phase shop.
- Endings cross the dominant path with one of three emphases: sect mastery, relationships/community, or wealth/reputation. Secondary path, relationships, injuries, technique mutations, and turning points color the biography.

## Earned sect membership and progression

- Sect selection appears only after the first three displayed rounds and records `aspiredSectId`; it is not membership. Before then, every character has only 亂拳直進、護住要害、and 喘勻這口氣.
- After round 3 resolves, a dedicated admission scene sets `sectId` and swaps in the chosen sect’s four-move kit.
- Technique mutations occur after displayed rounds 7, 11, and 14. Each sect has two choices at each tier. A mutation changes targeting, resource cadence, status use, defensive timing, or objective interaction; magnitude-only upgrades are not acceptable.
- 門派造詣 remains visible and contributes to the biography but never gates milestone timing.
- There are no mandatory flat post-battle upgrades.

## Mortal combat and real objectives

- Every actual battle is mortal. Player death, a protected actor’s death, or a missed deadline ends the life immediately. Peaceful authored event resolutions are the only risk-free way forward.
- Each encounter uses one structured objective shared by the preview, battle HUD, and resolver: `eliminate` defeats all enemies; `leader` defeats the named leader; `progress` spends player turns on an explicit action; `survive` withstands hostile actions; `peaceful` skips battle through an authored resolution.
- A progress action adds one point, consumes the player’s turn, and performs no martial move. Preparation may reduce required progress, remove an enemy, add an ally, or avoid battle.
- Grades reward objective completion, remaining health, useful preparation, and optional threat neutralization. Pressing unnecessary moves is never rewarded.
- The battle engine remains pure and deterministic. Enemy committed intents, inner-power costs, rest behavior, explicit effect recipients, seeded starting positions, and progress overflow reproduce from saved state.

## Death journal and permanent talents

- Every authored event owns one stable death definition: unique id, comic title, concrete cause, actionable hint, and one concise epitaph.
- The first record of a death id awards one death point and persists immediately. Repeating that event death awards zero, regardless of seed or battle details.
- Between lives, death points buy permanent talents: Common 1, Rare 3, Legendary 6. Purchases are non-refundable, but each purchased talent can be enabled or disabled before a new life.
- Every enabled talent applies in the next life with its full benefit and drawback. Its enabled set is fixed once that life begins; conflicting enabled drawbacks intentionally coexist.
- A current-life seeded talent is chosen only from talents not already purchased, including purchased talents disabled for inheritance. Duplicate effects never stack.
- Each new run snapshots the sorted enabled legacy list. Deterministic reproduction includes version, seed, identity, difficulty, choices, and this legacy snapshot.
- Talent composition uses one canonical order: base values; multipliers; additive benefits and costs; caps and minimums. Recovery starts at 60% and clamps to 40–85%.
- Legacy `前世見聞.discoveredTraits` migrates into permanently purchased talents at no cost.

## Persistence and replay

- `LifeRun` version 15 is the compatibility boundary. Version-14 in-progress lives restart while migrated meta progress survives.
- Meta progress is separately versioned and stores death points, discovered death ids, purchased talents, and which purchases are disabled for the next life.
- Enemy scaling comes from difficulty and campaign turn. It never compensates for purchased talents: dying, learning, buying power, and eventually winning is the intended long arc.
- Replay must come from curiosity and accumulated knowledge, not artificial waiting, paid rerolls, misleading odds, or punishment for stopping.

## Current technical boundaries

- `app/life-engine.ts` owns deterministic campaign state, events, admission, talents, and endings.
- `app/battle/` owns deterministic objective and combat transitions.
- `app/page.tsx` renders state and persists versioned run/meta snapshots; displayed rules must come from the same structured data that resolves them.
