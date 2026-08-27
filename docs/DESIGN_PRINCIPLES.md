# Design principles

## Player experiment

The player begins as an ordinary late-Ming youth and wants to discover what kind of martial life this imperfect person can build before age, a lost battle, and accumulated obligations close the road.

Every run follows this loop:

> reveal meaningful state → present a consequential choice → resolve bounded uncertainty → persist the consequence → remember it in the biography → create the next question

## Whole-life structure

- A life can span up to sixteen turns across youth, entry, wandering, renown, and later life. Each phase changes the context and stakes, not only the numbers; losing any battle kills the character and ends the run immediately.
- Seeded identity reveals origin, a conditional trait, and a burden. After at least one finished life, the player may also carry one previously encountered trait into the next life; the selected inherited trait and the newly seeded trait both apply, and the seeded draw excludes the inherited trait so the choice always creates a distinct two-trait build. Current ability is shown separately from potential; growth moves toward visible ceilings and potential never guarantees greatness.
- Origin, trait, and burden each use a seeded rarity roll: 普通 60%, 稀有 30%, 傳說 10%, followed by an even pick within the rolled tier. Higher rarity is generally stronger and more run-defining, but every rare or legendary advantage carries a larger, explicit side effect. Rarity reviews weigh whole-run survival impact, compounding value, trigger reliability, and opportunity cost; evocative flavor alone never raises a tier. A legendary identity should create a build question, not a free win. The reveal cards show each rolled tier and the complete benefit/cost text without a separate probability explanation block.
- The talent pool contains eighteen mechanically distinct talents, split evenly across the three rarity tiers. Talents should alter conditional decisions or life context—preparation, weather, enemy count, wealth, relationships, growth, recovery, or resources—not merely rename the same flat bonus.
- The six sects are distinct move kits and play styles. Victories build visible 門派造詣; at 35, 85, and 145 the player chooses one of two permanent, sect-specific insights that modify an existing move. A sect provides direction, while insight choices turn that direction into a player-authored fighting identity.
- Each turn previews a concrete encounter objective and offers exactly three preparations: two methods authored for that event and one legal contextual method selected from the character's sect, resources, injuries, friend, or rival. Every choice has a visible seeded success rate derived from two named current stats and semantic talent hooks; its guaranteed costs, success effects, and failure fallback come from the same structured rule data used to resolve it. Before combat begins, an acknowledged feedback beat persists the exact preparation outcome and why the encounter remains unavoidable.
- Each phase deals its seeded event deck without replacement. The two scheduled rival encounters may replace a dealt scene, but ordinary scene repetition cannot occur within a phase.

## Agency, uncertainty, and causality

- The same game version, seed, identity, difficulty, and choices must reproduce identity, scene order, battle seeds, and outcomes.
- Important choices change growth, money, reputation, relationships, combat preparation, future support, or the ending. Effects must be previewed before commitment.
- Randomness is bounded and explainable. The player chooses what to prepare for and the biography records consequential outcomes.
- Preparation rolls use the run seed, turn, and choice id, so the displayed chance and the resulting success or failure reproduce exactly with the rest of the life.
- Battle risk is terminal and stated before the run begins: victory continues the career, while defeat becomes a deterministic death ending. Death records the unfinished life instead of granting post-battle growth or recovery.

## Biography and relationships

- Every battle result is both feedback and a biography record: victory records grade, named moment, recovery, rewards, and one chronicle line; defeat records the death reason and closes the biography.
- A victory at or below 35% of maximum health adds one permanent old injury. The result names the injury and the character sheet keeps its running total; four or more old injuries can define the closing biography.
- Every life seeds one friend and one rival. Choices that explicitly protect or invite the friend can bring that person into battle; choices that invoke the rival reuse accumulated resentment; milestone rematches and the ending reuse both people.
- Endings are short biographies built from turning points, defining relationships, injuries, unrealized possibilities, and reputation—not raw stat dumps.

## Progression and replay

- Three deterministic difficulty profiles alter the pressure without changing causality.
- Every life that reaches an ending, including a death, adds its primary trait to the locally stored 前世見聞 collection. On the next start the player may inherit one collected trait or deliberately take none; this replaces flat 師門傳承 stat ranks with a conditional build choice and never grants more than one inherited trait at a time.
- Seeds support replay, comparison, sharing, and debugging. Reproduction includes the selected inherited trait as well as the game version, seed, identity, difficulty, event-specific choice ids, and insights. Save compatibility is explicit through the run version; inherited talents begin at save version 9, the reviewed rarity tiers at version 10, committed battle intents at version 11, and dynamic choices plus 門派造詣 at version 12. Earlier in-progress runs restart while the separate 前世見聞 collection remains intact.

## Ethical engagement

Replay should come from curiosity about another possible life, not artificial waiting, loss chasing, paid rerolls, misleading odds, or punishment for stopping.

## Current technical boundaries

- `app/life-engine.ts` owns life state and rules.
- `app/battle/` stays pure and deterministic.
- Browser storage is used only for the current local save and the collected 前世見聞 talent list.
- Combat advances automatically through non-player turns. Player input is reserved for target and move decisions. Move controls remain visible throughout battle and are disabled outside the player's turn.
- Every non-player combatant commits to one action and target before acting. A random target is drawn once, displayed to the player for enemies, and reused when the action resolves; the intent is replanned only when its action or target becomes invalid. Effect recipients are explicit rule data rather than inferred from the action target.
- Combat timeline progress advances by one deterministic tick every 180 ms while active. Each living actor adds its effective speed, the highest-progress actor alone becomes ready at 100, and acting subtracts 100 so overflow survives. The clock pauses for player input; AI resolves immediately before the next tick. CSS interpolates between ticks without adding simulation updates.
- Each battle draws seeded starting timeline positions without replacement, so every actor begins at a distinct progress value while the same seed still reproduces the same opening order.
